"use client";

import { useEffect, useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erreur : Les variables d'environnement Supabase sont manquantes.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ClientPage() {
  const [produits, setProduits] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categorieActive, setCategorieActive] = useState("");
  
  const [panier, setPanier] = useState<any[]>([]);
  const [panierOuvert, setPanierOuvert] = useState(false);
  
  const [produitOuvert, setProduitOuvert] = useState<any | null>(null);
  
  // Système de format unifié
  const [formatChoisi, setFormatChoisi] = useState<any>(null);
  const [quantite, setQuantite] = useState<number>(1);
  const [supplementsCoches, setSupplementsCoches] = useState<any[]>([]);

  const [nomClient, setNomClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [noteClient, setNoteClient] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [commandeValidee, setCommandeValidee] = useState(false);
  const [numeroCommande, setNumeroCommande] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      const [catRes, prodRes] = await Promise.all([
        supabase.from("categories").select("*").order("id", { ascending: true }),
        supabase.from("produits").select("*").order("id", { ascending: false })
      ]);

      if (catRes.data) { 
        setCategories(catRes.data); 
        if (catRes.data.length > 0) setCategorieActive(catRes.data[0].nom); 
      }
      if (prodRes.data) {
        setProduits(prodRes.data);
      }
    }
    loadData();
  }, []);

  const ouvrirOptionsProduit = (produit: any) => {
    setProduitOuvert(produit);
    // On sélectionne par défaut le décant de 10ml
    setFormatChoisi({ id: 'ml-10', prixUnitaire: produit.prix, nom: 'Décant 10 ml' });
    setQuantite(1);
    setSupplementsCoches([]);
  };

  const toggleSupplement = (supp: any) => {
    if (supplementsCoches.some(s => s.nom === supp.nom)) {
      setSupplementsCoches(supplementsCoches.filter(s => s.nom !== supp.nom));
    } else {
      setSupplementsCoches([...supplementsCoches, supp]);
    }
  };

  const ajouterAuPanierDirect = () => {
    if (!produitOuvert || !formatChoisi) return;

    const prixSupps = supplementsCoches.reduce((t, s) => t + s.prix, 0);
    const prixUnitaireTotal = formatChoisi.prixUnitaire + prixSupps;
    const prixTotalLigne = prixUnitaireTotal * quantite;

    const newItem = {
      idUnique: crypto.randomUUID(),
      produit_id: produitOuvert.id,
      nom: produitOuvert.titre || produitOuvert.nom,
      formatNom: formatChoisi.nom,
      prixUnitaire: prixUnitaireTotal,
      prixTotal: prixTotalLigne,
      quantite: quantite,
      supplements: supplementsCoches
    };

    setPanier([...panier, newItem]);
    setProduitOuvert(null); 
  };

  const retirerDuPanier = (idUnique: string) => {
    const nouveauPanier = panier.filter(item => item.idUnique !== idUnique);
    setPanier(nouveauPanier);
    if (nouveauPanier.length === 0) setPanierOuvert(false);
  };

  const totalPanier = panier.reduce((total, item) => total + item.prixTotal, 0);
  const nombreArticles = panier.reduce((total, item) => total + item.quantite, 0);

  const handleCommander = async (e: FormEvent) => {
    e.preventDefault();
    if (panier.length === 0) return alert("Votre panier est vide !");
    setEnvoiEnCours(true);

    let details = panier.map(item => {
      let desc = `- ${item.quantite}x ${item.nom} [Format: ${item.formatNom}]`;
      if (item.supplements && item.supplements.length > 0) {
        desc += `\n  Extras: ${item.supplements.map((s:any) => s.nom).join(', ')}`;
      }
      return desc;
    }).join('\n\n');

    if (noteClient.trim()) {
      details += `\n\n📝 NOTE CLIENT :\n${noteClient.trim()}`;
    }

    const { data, error } = await supabase.from("commandes").insert([{
      nom_client: nomClient, 
      telephone_client: telephone, 
      adresse_livraison: adresse, 
      total: totalPanier, 
      details_commande: details, 
      statut: "en attente"
    }]).select();

    setEnvoiEnCours(false);
    
    if (!error && data && data.length > 0) {
      setNumeroCommande(data[0].id); 
      setCommandeValidee(true); 
      setPanier([]); 
      setNomClient(""); 
      setTelephone(""); 
      setAdresse(""); 
      setNoteClient("");
    } else { 
      alert("Erreur lors de la commande : " + error?.message); 
    }
  };

  // Création de la liste des formats disponibles
  let formatsDisponibles: any[] = [];
  if (produitOuvert) {
    // 1. Génération des Décants (basés sur le prix de 10ml)
    formatsDisponibles = [
      { id: 'ml-10', prixUnitaire: produitOuvert.prix, nom: 'Décant 10 ml' },
      { id: 'ml-20', prixUnitaire: produitOuvert.prix * 2, nom: 'Décant 20 ml' },
      { id: 'ml-30', prixUnitaire: produitOuvert.prix * 3, nom: 'Décant 30 ml' },
      { id: 'ml-50', prixUnitaire: produitOuvert.prix * 5, nom: 'Décant 50 ml' },
    ];
    // 2. Ajout des Bouteilles Complètes ou Variantes
    if (produitOuvert.variantes) {
      produitOuvert.variantes.forEach((v: any, index: number) => {
        formatsDisponibles.push({
          id: `var-${index}`,
          // CORRECTION ICI : Le prix de la bouteille est EXACTEMENT le prix entré par l'admin !
          prixUnitaire: v.prix, 
          nom: `✨ ${v.nom}`
        });
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1128] text-gray-100 font-sans pb-32 selection:bg-[#C59B27] selection:text-[#0A1128]">
      
      {/* 🔴 BLOC FIXE : HEADER + NAVIGATION CATEGORIES 🔴 */}
      <div className="sticky top-0 z-30 bg-[#0A1128]/95 backdrop-blur-md shadow-lg border-b border-[#C59B27]/20">
        <header className="pt-5 pb-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Hamza Parfums" className="h-14 w-14 object-cover rounded-full border-2 border-[#C59B27] shadow-[0_0_10px_rgba(197,155,39,0.3)]" />
            <div className="flex flex-col">
              <span className="text-[#C59B27] font-bold text-sm tracking-wide">Hamza Parfum Birtouta</span>
              <span className="text-gray-400 text-[10px] uppercase tracking-widest mt-0.5 font-semibold">L'Essence de l'Élégance</span>
            </div>
          </div>
          <a href="tel:0556458402" className="flex items-center gap-2 group active:scale-95 transition-all shrink-0">
            <span className="text-[#C59B27] font-bold text-[10px] sm:text-xs uppercase tracking-widest text-right leading-tight">Contact</span>
            <div className="bg-[#111C3A] border border-[#C59B27]/30 w-10 h-10 rounded-full flex items-center justify-center group-hover:border-[#C59B27] shadow-sm transition-colors">
              <span className="text-lg">📞</span>
            </div>
          </a>
        </header>

        <nav className="flex overflow-x-auto gap-3 px-4 pb-4 scrollbar-none">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setCategorieActive(cat.nom)} className={`shrink-0 px-5 py-2.5 rounded-full font-bold uppercase text-sm tracking-wider transition-all border ${categorieActive === cat.nom ? "bg-[#C59B27] text-[#0A1128] border-[#C59B27] shadow-[0_0_15px_rgba(197,155,39,0.4)]" : "bg-[#111C3A] text-gray-400 border-transparent hover:bg-[#16244A]"}`}>
              {cat.nom}
            </button>
          ))}
        </nav>
      </div>
      {/* 🔴 FIN DU BLOC FIXE 🔴 */}

      <main className="p-4 max-w-5xl mx-auto mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {produits.filter(p => p.categorie === categorieActive).map(produit => (
            <div key={produit.id} onClick={() => ouvrirOptionsProduit(produit)} className="bg-[#111C3A] border border-[#1C2C59] rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-lg hover:border-[#C59B27]/40 flex flex-col">
              
              {/* IMAGE ENTIERE (object-contain) */}
              <div className="w-full aspect-square bg-[#060A17] flex items-center justify-center p-2 relative overflow-hidden">
                {produit.image_url ? (
                  <img src={produit.image_url} alt={produit.titre} className="w-full h-full object-contain drop-shadow-2xl" />
                ) : (
                  <div className="text-5xl opacity-50">✨</div>
                )}
              </div>
              
              <div className="p-5 flex-1 flex flex-col justify-between border-t border-[#1C2C59]/50">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-white leading-tight">{produit.titre || produit.nom}</h3>
                    <span className="bg-[#C59B27]/10 text-[#C59B27] px-3 py-1 rounded-lg font-black text-sm ml-3 border border-[#C59B27]/20 shrink-0 text-center">
                      {produit.prix} DA<span className="block text-[10px] font-medium opacity-80">/ 10 ml</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2 mt-2 font-medium">{produit.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL DU PRODUIT */}
      {produitOuvert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#0A1128] w-full max-w-md border-t sm:border border-[#1C2C59] rounded-t-4xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            
            {/* IMAGE EN HAUT DU MODAL */}
            <div className="relative shrink-0 bg-[#060A17] p-4 flex justify-center items-center h-56 border-b border-[#1C2C59]/50">
              {produitOuvert.image_url && <img src={produitOuvert.image_url} alt="Image" className="w-full h-full object-contain drop-shadow-2xl" />}
              <button onClick={() => setProduitOuvert(null)} className="absolute top-4 right-4 bg-[#111C3A]/80 backdrop-blur text-gray-300 p-2 rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-sm border border-[#1C2C59] hover:bg-[#1C2C59]">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-3 text-center">{produitOuvert.titre || produitOuvert.nom}</h2>
              
              {/* AFFICHAGE DYNAMIQUE DU PRIX SELON LE CHOIX */}
              <div className="bg-[#111C3A] border border-[#C59B27]/30 py-3 rounded-xl mb-6 shadow-inner flex flex-col items-center justify-center">
                 <p className="text-[#C59B27] font-black text-2xl">{formatChoisi?.prixUnitaire || produitOuvert.prix} DA</p>
                 <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">{formatChoisi?.nom || 'Décant 10 ml'}</p>
              </div>
              
              {/* 1. CHOIX DU FORMAT (GRILLE) */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-3 border-b border-[#1C2C59] pb-2">1. Choisissez le format</h3>
                <div className="grid grid-cols-2 gap-3">
                  {formatsDisponibles.map(f => {
                    const estCoche = formatChoisi?.id === f.id;
                    return (
                      <div key={f.id} onClick={() => setFormatChoisi(f)} className={`p-4 rounded-2xl border cursor-pointer flex flex-col items-center justify-center text-center transition-all ${estCoche ? 'bg-[#C59B27]/10 border-[#C59B27] shadow-[0_0_10px_rgba(197,155,39,0.15)]' : 'bg-[#111C3A] border-[#1C2C59] hover:border-[#C59B27]/40'}`}>
                        <span className={`font-bold text-sm ${estCoche ? 'text-[#C59B27]' : 'text-gray-200'}`}>{f.nom}</span>
                        <span className="text-[#C59B27] font-black mt-1">{f.prixUnitaire} DA</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. QUANTITE */}
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-3 border-b border-[#1C2C59] pb-2">2. Quantité</h3>
                <div className="flex items-center justify-between bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-3">
                  <span className="text-sm font-bold text-gray-400">Nombre d'articles :</span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => { if(quantite > 1) setQuantite(quantite - 1) }}
                      className="w-10 h-10 rounded-full bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center text-xl font-bold text-[#C59B27] hover:bg-[#16244A] transition-colors"
                    >-</button>
                    <span className="font-black text-white text-lg w-8 text-center">{quantite}</span>
                    <button 
                      onClick={() => setQuantite(quantite + 1)}
                      className="w-10 h-10 rounded-full bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center text-xl font-bold text-[#C59B27] hover:bg-[#16244A] transition-colors"
                    >+</button>
                  </div>
                </div>
              </div>

              {/* 3. EXTRAS */}
              {produitOuvert.supplements && produitOuvert.supplements.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-4 border-b border-[#1C2C59] pb-2">3. Options & Extras</h3>
                  <div className="space-y-3">
                    {produitOuvert.supplements.map((supp: any, idx: number) => {
                      const estCoche = supplementsCoches.some(s => s.nom === supp.nom);
                      return (
                        <div key={idx} onClick={() => toggleSupplement(supp)} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${estCoche ? "bg-[#C59B27]/10 border-[#C59B27]" : "bg-[#111C3A] border-[#1C2C59] hover:border-[#C59B27]/30"}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-lg border-2 text-center leading-5 flex items-center justify-center shrink-0 ${estCoche ? "bg-[#C59B27] border-[#C59B27] text-[#0A1128]" : "bg-[#0A1128] border-[#1C2C59] text-transparent"}`}>✓</div>
                            <span className="font-bold text-white text-sm">{supp.nom}</span>
                          </div>
                          <span className="text-[#C59B27] font-black">+{supp.prix} DA</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-[#1C2C59] bg-[#0A1128] shrink-0">
              <button onClick={ajouterAuPanierDirect} className="w-full bg-[#C59B27] text-[#0A1128] font-black py-5 rounded-2xl uppercase text-sm shadow-[0_0_15px_rgba(197,155,39,0.3)] flex justify-between px-6 transition-transform active:scale-95">
                <span>Ajouter au panier</span>
                <span className="bg-[#0A1128] text-[#C59B27] px-3 py-1 rounded-lg">
                  {((formatChoisi?.prixUnitaire || 0) + supplementsCoches.reduce((t, s) => t + s.prix, 0)) * quantite} DA
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOUTON FLOTTANT DU PANIER */}
      {panier.length > 0 && !panierOuvert && !produitOuvert && (
        <button onClick={() => setPanierOuvert(true)} className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-[#C59B27] text-[#0A1128] font-black py-5 px-6 rounded-2xl shadow-[0_10px_25px_rgba(197,155,39,0.3)] flex justify-between items-center z-40 uppercase tracking-wider text-sm border-2 border-[#C59B27] transition-transform hover:scale-105 active:scale-95">
          <span className="bg-[#0A1128] text-[#C59B27] w-8 h-8 flex items-center justify-center rounded-full">{nombreArticles}</span>
          <span>Voir mon panier</span>
          <span>{totalPanier} DA</span>
        </button>
      )}

      {/* MODAL DU PANIER COMPLET */}
      {panierOuvert && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-[#0A1128] w-full max-w-md border-t sm:border border-[#1C2C59] rounded-t-4xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-[#1C2C59] flex justify-between items-center bg-[#0A1128] shrink-0">
              <h2 className="text-xl font-bold uppercase tracking-wider text-white">🛍️ Mon Panier</h2>
              <button onClick={() => setPanierOuvert(false)} className="text-gray-400 bg-[#111C3A] border border-[#1C2C59] w-10 h-10 rounded-full flex items-center justify-center font-bold hover:bg-[#16244A]">✕</button>
            </div>
            
            {commandeValidee ? (
              <div className="p-10 text-center overflow-y-auto">
                <span className="text-6xl block mb-6">✨</span>
                <h3 className="text-2xl font-black text-[#C59B27] mb-6 uppercase">Commande Envoyée !</h3>
                <div className="bg-[#111C3A] border border-[#C59B27]/30 rounded-2xl p-6 mb-8 inline-block shadow-inner">
                  <p className="text-[#C59B27] text-xs uppercase tracking-widest mb-2 font-bold">N° de commande</p>
                  <p className="text-5xl font-black text-white">#{numeroCommande}</p>
                </div>
                <p className="text-gray-400 mb-6 font-medium">L'essence de l'élégance est en route.</p>
                <button onClick={() => { setCommandeValidee(false); setPanierOuvert(false); setNumeroCommande(null); }} className="bg-[#C59B27] text-[#0A1128] font-bold py-4 px-8 rounded-2xl uppercase w-full">Retour à la boutique</button>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4 mb-8">
                  {panier.map((item) => (
                    <div key={item.idUnique} className="flex justify-between items-center bg-[#111C3A] border border-[#1C2C59] p-4 rounded-2xl shadow-sm">
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-lg">
                          <span className="text-[#C59B27]">{item.quantite}x</span> {item.nom}
                        </h4>
                        <p className="text-sm text-[#C59B27] mt-1 font-bold">Format : <span className="text-[#C59B27]">{item.formatNom}</span></p>
                        {item.supplements && item.supplements.length > 0 && <p className="text-xs text-gray-500 mt-1 font-medium">Extras : {item.supplements.map((s:any) => s.nom).join(', ')}</p>}
                        <p className="text-white font-black mt-2">{item.prixTotal} DA</p>
                      </div>
                      <button onClick={() => retirerDuPanier(item.idUnique)} className="text-red-400 bg-red-500/10 p-3 rounded-xl ml-4 hover:bg-red-500/20 transition-colors">🗑️</button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-end border-t border-[#1C2C59] pt-6 mb-8">
                  <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">Total à payer</span>
                  <span className="text-4xl font-black text-[#C59B27]">{totalPanier} DA</span>
                </div>
                <form onSubmit={handleCommander} className="space-y-4 pb-6">
                  <input type="text" required placeholder="Nom complet" value={nomClient} onChange={(e) => setNomClient(e.target.value)} className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500" />
                  <input type="tel" required placeholder="N° Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500" />
                  <textarea required rows={2} placeholder="Adresse complète (ex: Birtouta, Centre)..." value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500" />
                  <textarea rows={2} placeholder="Remarque (Optionnel)" value={noteClient} onChange={(e) => setNoteClient(e.target.value)} className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] text-sm placeholder-gray-500" />
                  <button type="submit" disabled={envoiEnCours} className="w-full bg-[#C59B27] text-[#0A1128] font-black py-5 rounded-2xl uppercase text-sm mt-6 disabled:opacity-70 transition-transform active:scale-95 shadow-[0_0_15px_rgba(197,155,39,0.3)]">
                    {envoiEnCours ? "Transmission..." : "✨ Confirmer la commande"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}