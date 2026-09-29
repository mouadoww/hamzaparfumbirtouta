"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabaseUrl = rawUrl.replace(/['"]/g, '').trim().replace(/\/$/, "");
const supabaseAnonKey = rawKey.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erreur : Les variables d'environnement Supabase sont manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BUCKET_NAME = "images";

export default function AdminDashboard() {
  const [estAdminAuthentifie, setEstAdminAuthentifie] = useState(false);
  const [saisieCodeAdmin, setSaisieCodeAdmin] = useState("");
  const [ongletActif, setOngletActif] = useState<"commandes" | "menu" | "livreurs" | "categories">("commandes");

  const [commandes, setCommandes] = useState<any[]>([]);
  const [chargementCommandes, setChargementCommandes] = useState(true);
  const [livreurSelectionne, setLivreurSelectionne] = useState<{ [key: number]: string }>({});

  const [livreurs, setLivreurs] = useState<any[]>([]);
  const [nomLivreur, setNomLivreur] = useState("");
  const [telLivreur, setTelLivreur] = useState("");
  const [passLivreur, setPassLivreur] = useState("");

  const [categories, setCategories] = useState<any[]>([]);
  const [nomNouvelleCategorie, setNomNouvelleCategorie] = useState("");
  const [messageCategorie, setMessageCategorie] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [produits, setProduits] = useState<any[]>([]);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [prixBouteille, setPrixBouteille] = useState(""); // 🍾 Prix principal : Bouteille Complète
  const [proposerDecant, setProposerDecant] = useState(true);
  const [prixDecant10ml, setPrixDecant10ml] = useState(""); // 🧪 Prix optionnel 10 ml
  const [categorieSelected, setCategorieSelected] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [variantes, setVariantes] = useState<{nom: string, prix: number}[]>([]);
  const [varNom, setVarNom] = useState("");
  const [varPrix, setVarPrix] = useState("");

  const [supplements, setSupplements] = useState<{nom: string, prix: number}[]>([]);
  const [suppNom, setSuppNom] = useState("");
  const [suppPrix, setSuppPrix] = useState("");

  const [uploading, setUploading] = useState(false);
  const [messageMenu, setMessageMenu] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingProduit, setEditingProduit] = useState<any | null>(null);

  useEffect(() => {
    if (localStorage.getItem("adminAuth") === "true") setEstAdminAuthentifie(true);
  }, []);

  useEffect(() => {
    if (estAdminAuthentifie) {
      fetchCommandes(); 
      fetchCategories(); 
      fetchProduits(); 
      fetchLivreurs();

      const channel = supabase
        .channel('custom-insert-channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'commandes' },
          (payload) => {
            fetchCommandes();
            try {
              const audio = new Audio('/notif.mp3');
              audio.play().catch(() => console.log("Son bloqué"));
            } catch {
              console.log("Impossible de jouer le son");
            }
            setTimeout(() => {
              alert(`🚨 DING DING ! NOUVELLE COMMANDE !\n\n👨 Client : ${payload.new.nom_client}\n💰 Total : ${payload.new.total} DA\n\nVérifiez votre tableau de bord !`);
            }, 500);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [estAdminAuthentifie]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (saisieCodeAdmin === "admin123") { 
      setEstAdminAuthentifie(true); 
      localStorage.setItem("adminAuth", "true"); 
    } else {
      alert("❌ Code administrateur incorrect !");
    }
  };

  const formaterDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' + 
           date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  async function fetchCategories() {
    const { data, error } = await supabase.from("categories").select("*").order("id", { ascending: true });
    if (!error && data) { 
      setCategories(data); 
      if (data.length > 0 && !categorieSelected) setCategorieSelected(data[0].nom); 
    }
  }

  async function handleAjouterCategorie(e: React.FormEvent) {
    e.preventDefault(); setMessageCategorie(null);
    if (!nomNouvelleCategorie.trim()) return;
    const { error } = await supabase.from("categories").insert([{ nom: nomNouvelleCategorie.trim() }]);
    if (!error) { 
      setMessageCategorie({ type: "success", text: "Catégorie ajoutée !" }); 
      setNomNouvelleCategorie(""); 
      fetchCategories(); 
    } else {
      setMessageCategorie({ type: "error", text: "Erreur : " + error.message });
    }
  }

  async function handleSupprimerCategorie(id: number, nom: string) {
    if (!window.confirm(`Supprimer la catégorie "${nom}" ?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (!error) fetchCategories();
  }

  async function fetchCommandes() {
    setChargementCommandes(true);
    const { data, error } = await supabase.from("commandes").select("*").order("id", { ascending: false });
    if (!error) setCommandes(data || []);
    setChargementCommandes(false);
  }

  async function modifierStatutCommande(id: number, nouveauStatut: string) {
    const { error } = await supabase.from("commandes").update({ statut: nouveauStatut }).eq("id", id);
    if (!error) fetchCommandes();
  }

  async function attribuerLivreur(commandeId: number) {
    const livreurIdStr = livreurSelectionne[commandeId];
    if (!livreurIdStr) return alert("Sélectionner un livreur !");
    const { error } = await supabase.from("commandes").update({ livreur_id: parseInt(livreurIdStr, 10), statut: "en route" }).eq("id", commandeId);
    if (!error) fetchCommandes();
  }

  async function fetchLivreurs() {
    const { data, error } = await supabase.from("livreurs").select("*").order("nom");
    if (!error && data) {
      setLivreurs(data);
    }
  }

  async function handleAjouterLivreur(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("livreurs").insert([{ nom: nomLivreur, telephone: telLivreur, mot_de_passe: passLivreur }]);
    if (!error) { setNomLivreur(""); setTelLivreur(""); setPassLivreur(""); fetchLivreurs(); }
  }

  async function handleSupprimerLivreur(id: number, nom: string) {
    if (!window.confirm(`Supprimer le livreur ${nom} ?`)) return;
    const { error } = await supabase.from("livreurs").delete().eq("id", id);
    if (!error) fetchLivreurs();
  }

  async function fetchProduits() {
    const { data, error } = await supabase.from("produits").select("*").order("id", { ascending: false });
    if (!error) setProduits(data || []);
  }

  const chargerFormulairePourModification = (produit: any) => {
    setEditingProduit(produit); 
    setTitre(produit.titre || produit.nom || "");
    setDescription(produit.description || ""); 
    setPrixBouteille(produit.prix?.toString() || "");
    
    // Détecter si un prix de décant 10ml est déjà enregistré
    if (produit.prix_decant_10ml) {
      setProposerDecant(true);
      setPrixDecant10ml(produit.prix_decant_10ml.toString());
    } else {
      setProposerDecant(false);
      setPrixDecant10ml("");
    }

    setCategorieSelected(produit.categorie || (categories.length > 0 ? categories[0].nom : ""));
    setImageUrl(produit.image_url || "");
    setVariantes(produit.variantes || []); 
    setSupplements(produit.supplements || []); 
    setImageFile(null); 
    setMessageMenu(null); 
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const annulerModification = () => {
    setEditingProduit(null);
    setTitre("");
    setDescription("");
    setPrixBouteille("");
    setProposerDecant(true);
    setPrixDecant10ml("");
    setImageUrl("");
    setCategorieSelected(categories.length > 0 ? categories[0].nom : ""); 
    setVariantes([]);
    setSupplements([]);
    setImageFile(null);
    setMessageMenu(null); 
    setVarNom("");
    setVarPrix("");
    setSuppNom("");
    setSuppPrix("");
  };

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setUploading(true); 
    setMessageMenu(null);
    try {
      if (!supabaseUrl) throw new Error("URL Supabase introuvable ou mal configurée.");

      let finalImageUrl = imageUrl;
      
      if (imageFile) {
        const fileName = `parfum_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          throw new Error(`Upload impossible: ${uploadError.message}`);
        }
        
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName);
          
        finalImageUrl = publicUrlData.publicUrl;
      }

      // Construction des données produit
      const donneesProduit: any = { 
        nom: titre, 
        titre: titre, 
        description: description, 
        prix: parseFloat(prixBouteille), // Bouteille complète
        prix_bouteille: parseFloat(prixBouteille),
        categorie: categorieSelected, 
        image_url: finalImageUrl, 
        variantes: variantes, 
        supplements: supplements 
      };

      // Si l'option décant est cochée, on stocke le tarif 10ml
      if (proposerDecant && prixDecant10ml) {
        donneesProduit.prix_decant_10ml = parseFloat(prixDecant10ml);
      } else {
        donneesProduit.prix_decant_10ml = null;
      }

      if (editingProduit) {
        const { error } = await supabase.from("produits").update(donneesProduit).eq("id", editingProduit.id);
        if (error) throw error; 
        setMessageMenu({ type: "success", text: "🔄 Produit mis à jour avec succès !" });
      } else {
        const { error } = await supabase.from("produits").insert([donneesProduit]);
        if (error) throw error; 
        setMessageMenu({ type: "success", text: "✅ Parfum ajouté au catalogue !" });
      }
      
      annulerModification(); 
      fetchProduits();
      
    } catch (error: any) { 
      setMessageMenu({ type: "error", text: "❌ " + error.message }); 
    } finally { 
      setUploading(false); 
    }
  };

  const handleSupprimerProduit = async (id: number, nomProduit: string) => {
    if (!window.confirm(`Supprimer "${nomProduit}" ?`)) return;
    const { error } = await supabase.from("produits").delete().eq("id", id);
    if (!error) fetchProduits();
  };

  if (!estAdminAuthentifie) {
    return (
      <div className="min-h-screen bg-[#0A1128] text-gray-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-[#111C3A] border border-[#1C2C59] p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <img src="/logo.png" alt="Logo Hamza Parfum Birtouta" className="h-20 w-auto mx-auto mb-4 object-contain rounded-full border border-[#C59B27]/30 shadow-[0_0_15px_rgba(197,155,39,0.3)]" />
          <h1 className="text-2xl font-black uppercase mb-1 text-white">Hamza Parfum</h1>
          <p className="text-xs text-[#C59B27] mb-6 uppercase tracking-widest font-bold">Espace Administration</p>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input type="password" value={saisieCodeAdmin} onChange={(e) => setSaisieCodeAdmin(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white text-center tracking-widest focus:border-[#C59B27] outline-none transition-colors" placeholder="••••••••" autoFocus />
            <button type="submit" className="w-full bg-[#C59B27] hover:bg-[#A37C1C] text-[#0A1128] font-bold py-3 rounded-lg uppercase tracking-wide transition-colors">Déverrouiller</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1128] text-gray-100 p-6 font-sans selection:bg-[#C59B27] selection:text-[#0A1128]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center flex flex-col items-center justify-center">
          <img src="/logo.png" alt="Logo" className="h-14 w-auto mb-2 object-contain rounded-full border border-[#C59B27]/30 shadow-[0_0_10px_rgba(197,155,39,0.2)]" />
          <h1 className="text-sm font-bold uppercase tracking-widest text-[#C59B27]">Hamza Parfum - Panel Admin</h1>
          <div className="h-0.5 w-16 bg-[#C59B27]/50 mt-2 rounded-full mx-auto"></div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10 border-b border-[#1C2C59] pb-4">
          <button onClick={() => setOngletActif("commandes")} className={`py-3 px-5 rounded-xl font-bold uppercase tracking-wider transition-all text-xs md:text-sm ${ongletActif === "commandes" ? "bg-[#C59B27] text-[#0A1128] shadow-[0_0_15px_rgba(197,155,39,0.3)]" : "bg-[#111C3A] text-gray-400 border border-[#1C2C59] hover:bg-[#16244A]"}`}>📦 Commandes ({commandes.length})</button>
          <button onClick={() => setOngletActif("categories")} className={`py-3 px-5 rounded-xl font-bold uppercase tracking-wider transition-all text-xs md:text-sm ${ongletActif === "categories" ? "bg-[#C59B27] text-[#0A1128] shadow-[0_0_15px_rgba(197,155,39,0.3)]" : "bg-[#111C3A] text-gray-400 border border-[#1C2C59] hover:bg-[#16244A]"}`}>📁 Catégories ({categories.length})</button>
          <button onClick={() => setOngletActif("menu")} className={`py-3 px-5 rounded-xl font-bold uppercase tracking-wider transition-all text-xs md:text-sm ${ongletActif === "menu" ? "bg-[#C59B27] text-[#0A1128] shadow-[0_0_15px_rgba(197,155,39,0.3)]" : "bg-[#111C3A] text-gray-400 border border-[#1C2C59] hover:bg-[#16244A]"}`}>✨ Boutique / Parfums</button>
          <button onClick={() => setOngletActif("livreurs")} className={`py-3 px-5 rounded-xl font-bold uppercase tracking-wider transition-all text-xs md:text-sm ${ongletActif === "livreurs" ? "bg-[#C59B27] text-[#0A1128] shadow-[0_0_15px_rgba(197,155,39,0.3)]" : "bg-[#111C3A] text-gray-400 border border-[#1C2C59] hover:bg-[#16244A]"}`}>🛵 Livreurs ({livreurs.length})</button>
        </div>

        {/* ONGLET 1 : COMMANDES */}
        {ongletActif === "commandes" && (
           <div className="bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold uppercase tracking-wider text-white">Suivi des commandes</h2>
               <button onClick={fetchCommandes} className="bg-[#0A1128] hover:bg-[#16244A] border border-[#1C2C59] text-[#C59B27] text-xs font-bold py-2 px-4 rounded-lg uppercase transition-colors">🔄 Rafraîchir</button>
             </div>
             {chargementCommandes ? ( <div className="text-center py-12 text-[#C59B27] animate-pulse">Chargement des commandes...</div> ) : commandes.length === 0 ? ( <p className="text-gray-500 text-center py-12">Aucune commande pour le moment.</p> ) : (
               <div className="space-y-4">
                 {commandes.map((cmd) => {
                   const livreurAttribue = livreurs.find(l => l.id === cmd.livreur_id);
                   return (
                     <div key={cmd.id} className="bg-[#0A1128] border border-[#1C2C59] p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                       <div className="space-y-1 grow w-full md:w-auto">
                         <div className="flex flex-wrap items-center gap-3">
                           <span className="text-sm bg-[#111C3A] text-gray-400 border border-[#1C2C59] px-2 py-1 rounded font-mono font-bold">#{cmd.id}</span>
                           {cmd.created_at && (
                             <span className="text-xs text-gray-400 bg-[#111C3A] border border-[#1C2C59] px-2 py-1 rounded-md font-mono flex items-center gap-1">
                               ⏱️ {formaterDate(cmd.created_at)}
                             </span>
                           )}
                           <h3 className="font-bold text-lg text-white ml-1">{cmd.nom_client}</h3>
                           <span className={`text-xs uppercase font-extrabold px-2 py-1 rounded ${cmd.statut === "en attente" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : cmd.statut === "en cours" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : cmd.statut === "en route" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
                             {cmd.statut === "en route" && livreurAttribue ? `En route (${livreurAttribue.nom})` : cmd.statut}
                           </span>
                         </div>
                         <p className="text-sm text-[#C59B27] font-bold mt-1">📞 {cmd.telephone_client || cmd.telephone}</p>
                         <p className="text-sm text-gray-400">📍 {cmd.adresse_livraison || cmd.adresse}</p>
                         
                         <div className="bg-[#111C3A] p-3 rounded-lg border border-[#1C2C59] mt-2 shadow-inner">
                           <p className="text-xs text-gray-500 uppercase font-bold mb-1">Détails de la commande :</p>
                           <p className="text-sm text-gray-200 font-medium whitespace-pre-wrap">{cmd.details_commande}</p>
                         </div>
                       </div>
                       <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-[#1C2C59]">
                         <div className="text-right w-full md:w-auto flex md:block justify-between items-center">
                           <span className="text-xs text-gray-500 uppercase">Total à encaisser</span>
                           <span className="text-2xl font-black text-[#C59B27] block">{cmd.total} DA</span>
                         </div>
                         <div className="flex flex-wrap md:flex-nowrap gap-2 w-full justify-end items-center">
                           {cmd.statut === "en attente" && <button onClick={() => modifierStatutCommande(cmd.id, "en cours")} className="bg-[#C59B27] hover:bg-[#A37C1C] text-[#0A1128] text-xs font-bold py-2 px-4 rounded-lg uppercase w-full md:w-auto transition-colors">✨ Préparer</button>}
                           {cmd.statut === "en cours" && (
                             <div className="flex gap-1 w-full md:w-auto">
                               <select value={livreurSelectionne[cmd.id] || ""} onChange={(e) => setLivreurSelectionne({ ...livreurSelectionne, [cmd.id]: e.target.value })} className="bg-[#111C3A] border border-[#1C2C59] text-xs font-bold p-2 rounded-lg text-white outline-none cursor-pointer focus:border-[#C59B27]">
                                 <option value="">-- Sélectionner --</option>
                                 {livreurs.map((l, index) => <option key={l.id || index} value={l.id ? String(l.id) : ""}>{l.nom}</option>)}
                               </select>
                               <button onClick={() => attribuerLivreur(cmd.id)} className="bg-purple-600/20 text-purple-400 border border-purple-600/30 hover:bg-purple-600 hover:text-white text-xs font-bold py-2 px-3 rounded-lg uppercase transition-colors">Confier</button>
                             </div>
                           )}
                           {cmd.statut === "en route" && <button onClick={() => modifierStatutCommande(cmd.id, "livré")} className="bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-bold py-2 px-3 rounded-lg uppercase hover:bg-green-600 hover:text-white transition-colors">Forcer Livré</button>}
                           <button onClick={async () => { if(window.confirm("Supprimer ?")) { await supabase.from("commandes").delete().eq("id", cmd.id); fetchCommandes(); } }} className="bg-[#111C3A] hover:bg-red-500/20 text-gray-500 hover:text-red-500 border border-[#1C2C59] hover:border-red-500/30 text-xs font-bold p-2 rounded-lg transition-colors">🗑️</button>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
        )}

        {/* ONGLET 2 : CATEGORIES */}
        {ongletActif === "categories" && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg h-fit">
               <h2 className="text-2xl font-bold mb-6 text-[#C59B27] uppercase">Créer une catégorie</h2>
               {messageCategorie && <div className={`p-4 rounded-lg mb-6 text-sm font-semibold border ${messageCategorie.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>{messageCategorie.text}</div>}
               <form onSubmit={handleAjouterCategorie} className="space-y-4">
                 <div><input type="text" required placeholder="Ex: Parfums Homme, Collection Privee..." value={nomNouvelleCategorie} onChange={(e) => setNomNouvelleCategorie(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white focus:border-[#C59B27] outline-none text-sm transition-colors" /></div>
                 <button type="submit" className="w-full bg-[#C59B27] hover:bg-[#A37C1C] text-[#0A1128] font-bold py-3 rounded-lg uppercase text-sm transition-colors">➕ Ajouter la catégorie</button>
               </form>
             </div>
             <div className="lg:col-span-2 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg">
               <h2 className="text-2xl font-bold mb-6 uppercase text-white">📁 Catégories Actives ({categories.length})</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {categories.map((cat, index) => (
                   <div key={cat.id || index} className="bg-[#0A1128] border border-[#1C2C59] p-4 rounded-xl flex justify-between items-center">
                     <span className="font-bold text-gray-200 text-lg">📁 {cat.nom}</span>
                     <button onClick={() => handleSupprimerCategorie(cat.id, cat.nom)} className="bg-red-500/10 text-red-500 text-xs font-bold py-2 px-3 rounded-lg hover:bg-red-500 hover:text-white border border-red-500/20 transition-colors">🗑️</button>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        )}

        {/* ONGLET 3 : MENU / BOUTIQUE */}
        {ongletActif === "menu" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg h-fit lg:sticky lg:top-6">
              <h2 className="text-2xl font-bold mb-6 text-[#C59B27] uppercase">{editingProduit ? "🔄 Modifier" : "✨ Ajouter un parfum"}</h2>
              {messageMenu && <div className={`p-4 rounded-lg mb-6 text-sm font-semibold border ${messageMenu.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>{messageMenu.text}</div>}
              <form onSubmit={handleMenuSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Nom du parfum (Ex: Ombre Nomade)</label>
                  <input type="text" required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white outline-none focus:border-[#C59B27] transition-colors" />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Catégorie</label>
                  <select value={categorieSelected} onChange={(e) => setCategorieSelected(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white outline-none cursor-pointer focus:border-[#C59B27] transition-colors">
                    {categories.map(cat => <option key={cat.id} value={cat.nom}>{cat.nom}</option>)}
                  </select>
                </div>
                
                {/* 🍾 PRIX DE LA BOUTEILLE COMPLÈTE */}
                <div className="bg-[#0A1128] border border-[#C59B27]/40 p-4 rounded-xl shadow-inner">
                  <label className="block text-xs font-bold uppercase text-[#C59B27] mb-1">🍾 Prix de la Bouteille Complète (DA)</label>
                  <p className="text-[10px] text-gray-400 mb-2">Prix affiché en vitrine pour l'achat du flacon original/complet.</p>
                  <input type="number" required placeholder="Ex: 12000" value={prixBouteille} onChange={(e) => setPrixBouteille(e.target.value)} className="w-full bg-[#111C3A] border border-[#1C2C59] rounded-lg p-3 text-white outline-none focus:border-[#C59B27] transition-colors font-bold text-lg" />
                </div>

                {/* 🧪 OPTION DÉCANT 10 ML */}
                <div className="bg-[#0A1128] border border-[#1C2C59] p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase text-blue-400 cursor-pointer flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={proposerDecant} 
                        onChange={(e) => setProposerDecant(e.target.checked)} 
                        className="w-4 h-4 rounded accent-[#C59B27]"
                      />
                      🧪 Proposer l'option Décant 10 ml
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-3">Si activé, les clients pourront aussi commander en formats décantés (10ml, 20ml, 30ml...).</p>
                  
                  {proposerDecant && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-bold">Prix pour 10 ml (DA) :</label>
                      <input 
                        type="number" 
                        required={proposerDecant}
                        placeholder="Ex: 1500" 
                        value={prixDecant10ml} 
                        onChange={(e) => setPrixDecant10ml(e.target.value)} 
                        className="w-full bg-[#111C3A] border border-blue-500/30 rounded-lg p-2.5 text-white outline-none focus:border-blue-400 text-sm font-semibold"
                      />
                    </div>
                  )}
                </div>

                {/* AUTRES VARIANTES */}
                <div className="bg-[#0A1128] border border-[#1C2C59] p-4 rounded-xl">
                  <label className="block text-xs font-bold uppercase text-purple-400 mb-1">🏷️ Autres formats / Variantes (Optionnel)</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="Nom (Ex: Coffret Cadeau)" value={varNom} onChange={(e) => setVarNom(e.target.value)} className="w-full bg-[#111C3A] border border-[#1C2C59] rounded-lg p-2 text-white outline-none focus:border-purple-400 text-sm" />
                    <input type="number" placeholder="Prix" value={varPrix} onChange={(e) => setVarPrix(e.target.value)} className="w-24 bg-[#111C3A] border border-[#1C2C59] rounded-lg p-2 text-white outline-none focus:border-purple-400 text-sm" />
                    <button type="button" onClick={() => { if (varNom) { setVariantes([...variantes, { nom: varNom, prix: parseFloat(varPrix||"0") }]); setVarNom(""); setVarPrix(""); } }} className="bg-[#C59B27] text-[#0A1128] font-bold px-3 py-2 rounded-lg text-sm hover:bg-[#A37C1C] transition-colors">+</button>
                  </div>
                  {variantes.map((v, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#111C3A] border border-[#1C2C59] p-2 rounded-lg text-sm mb-1"><span className="text-gray-200">{v.nom} <span className="text-purple-400 font-bold">({v.prix} DA)</span></span><button type="button" onClick={() => setVariantes(variantes.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-500">❌</button></div>
                  ))}
                </div>

                {/* EXTRAS */}
                <div className="bg-[#0A1128] border border-[#1C2C59] p-4 rounded-xl">
                  <label className="block text-xs font-bold uppercase text-amber-500 mb-1">➕ Les Extras Flacons</label>
                  <p className="text-[10px] text-gray-500 mb-3">Ex: "Flacon Luxe" (+150 DA)</p>
                  <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="Nom (Ex: Flacon Luxe)" value={suppNom} onChange={(e) => setSuppNom(e.target.value)} className="w-full bg-[#111C3A] border border-[#1C2C59] rounded-lg p-2 text-white outline-none focus:border-amber-500 text-sm" />
                    <input type="number" placeholder="Prix +" value={suppPrix} onChange={(e) => setSuppPrix(e.target.value)} className="w-24 bg-[#111C3A] border border-[#1C2C59] rounded-lg p-2 text-white outline-none focus:border-amber-500 text-sm" />
                    <button type="button" onClick={() => { if (suppNom) { setSupplements([...supplements, { nom: suppNom, prix: parseFloat(suppPrix||"0") }]); setSuppNom(""); setSuppPrix(""); } }} className="bg-[#C59B27] text-[#0A1128] font-bold px-3 py-2 rounded-lg text-sm hover:bg-[#A37C1C] transition-colors">+</button>
                  </div>
                  {supplements.map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#111C3A] border border-[#1C2C59] p-2 rounded-lg text-sm mb-1"><span className="text-gray-200">{s.nom} <span className="text-amber-500 font-bold">(+{s.prix} DA)</span></span><button type="button" onClick={() => setSupplements(supplements.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-500">❌</button></div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Image du parfum</label>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full bg-[#0A1128] border border-[#1C2C59] p-2 text-gray-400 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-[#C59B27]/10 file:text-[#C59B27] hover:file:bg-[#C59B27]/20" />
                </div>
                
                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={uploading || categories.length === 0} className="w-full bg-[#C59B27] hover:bg-[#A37C1C] text-[#0A1128] font-bold py-3 rounded-lg uppercase text-sm disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(197,155,39,0.2)]">
                    {uploading ? "Traitement en cours..." : editingProduit ? "💾 Enregistrer les modifs" : "✅ Valider et Ajouter"}
                  </button>
                  {editingProduit && <button type="button" onClick={annulerModification} className="w-full bg-[#111C3A] hover:bg-[#1C2C59] text-gray-400 border border-[#1C2C59] font-bold py-2 rounded-lg uppercase text-xs transition-colors">❌ Annuler</button>}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg">
              <h2 className="text-2xl font-bold mb-6 uppercase text-white">💎 Ton Catalogue</h2>
              {categories.map(cat => {
                const filtered = produits.filter(p => p.categorie === cat.nom);
                if (filtered.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-10">
                    <h3 className="text-xl font-bold text-[#C59B27] border-b border-[#1C2C59] pb-2 mb-4 uppercase tracking-widest">{cat.nom}</h3>
                    <div className="space-y-3">
                      {filtered.map((p) => (
                        <div key={p.id} className="bg-[#0A1128] p-4 rounded-xl border border-[#1C2C59] flex justify-between items-center hover:border-[#C59B27]/30 transition-colors">
                          <div className="flex gap-4 items-center">
                            <div className="w-16 h-16 bg-[#111C3A] rounded-lg flex items-center justify-center border border-[#1C2C59] p-1 shrink-0">
                              {p.image_url ? <img src={p.image_url} alt={p.titre} className="w-full h-full object-contain" /> : <span className="text-2xl">✨</span>}
                            </div>
                            
                            <div>
                              <h4 className="font-bold text-white text-lg">{p.titre || p.nom}</h4>
                              <p className="text-sm text-[#C59B27] font-bold">🍾 Bouteille Complète : {p.prix} DA</p>
                              {p.prix_decant_10ml && (
                                <p className="text-xs text-blue-400 font-medium">🧪 Décant 10 ml : {p.prix_decant_10ml} DA</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => chargerFormulairePourModification(p)} className="bg-[#111C3A] hover:bg-[#1C2C59] text-gray-300 border border-[#1C2C59] text-xs font-bold py-2 px-3 rounded-lg transition-colors">✏️</button>
                            <button onClick={() => handleSupprimerProduit(p.id, p.titre || p.nom)} className="bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-400 text-xs font-bold py-2 px-3 rounded-lg transition-colors">🗑️️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* ONGLET 4 : LIVREURS */}
        {ongletActif === "livreurs" && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg h-fit">
               <h2 className="text-2xl font-bold mb-6 text-[#C59B27] uppercase">🎯 Recruter un Livreur</h2>
               <form onSubmit={handleAjouterLivreur} className="space-y-4">
                 <input type="text" required placeholder="Nom complet" value={nomLivreur} onChange={(e) => setNomLivreur(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white outline-none focus:border-[#C59B27] text-sm transition-colors" />
                 <input type="tel" required placeholder="N° Téléphone" value={telLivreur} onChange={(e) => setTelLivreur(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white outline-none focus:border-[#C59B27] text-sm transition-colors" />
                 <input type="text" required placeholder="Mot de passe" value={passLivreur} onChange={(e) => setPassLivreur(e.target.value)} className="w-full bg-[#0A1128] border border-[#1C2C59] rounded-lg p-3 text-white outline-none focus:border-[#C59B27] text-sm font-mono transition-colors" />
                 <button type="submit" className="w-full bg-[#C59B27] hover:bg-[#A37C1C] text-[#0A1128] font-bold py-3 rounded-lg uppercase text-sm transition-colors shadow-[0_0_10px_rgba(197,155,39,0.2)]">➕ Recruter</button>
               </form>
             </div>
             <div className="lg:col-span-2 bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-6 shadow-lg">
               <h2 className="text-2xl font-bold mb-6 uppercase text-white">👥 L'Équipe de Livraison</h2>
               <div className="space-y-4">
                 {livreurs.map((livreur) => (
                   <div key={livreur.id} className="bg-[#0A1128] border border-[#1C2C59] p-4 rounded-xl flex justify-between items-center">
                     <div><h4 className="font-bold text-white">🛵 {livreur.nom}</h4><p className="text-xs text-gray-400">{livreur.telephone}</p></div>
                     <button onClick={() => handleSupprimerLivreur(livreur.id, livreur.nom)} className="bg-red-500/10 text-red-500 border border-red-500/20 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors">🗑️️</button>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        )}

      </div>
    </div>
  );
}