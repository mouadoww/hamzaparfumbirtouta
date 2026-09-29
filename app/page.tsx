"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

// --- TYPES & INTERFACES ---
interface Supplement {
  nom: string;
  prix: number;
}

interface Variante {
  nom: string;
  prix: number;
}

interface Produit {
  id: number | string;
  titre?: string;
  nom?: string;
  description?: string;
  prix: number;
  image_url?: string;
  categorie: string;
  variantes?: Variante[] | string;
  supplements?: Supplement[] | string;
}

interface Categorie {
  id: number | string;
  nom: string;
}

interface FormatOption {
  id: string;
  prixUnitaire: number;
  nom: string;
}

interface PanierItem {
  idUnique: string;
  produit_id: number | string;
  nom: string;
  formatNom: string;
  prixUnitaire: number;
  prixTotal: number;
  quantite: number;
  supplements: Supplement[];
}

// --- INITIALISATION SUPABASE SÉCURISÉE ---
// Même nettoyage que dans la page admin (guillemets, espaces, slash final)
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseUrl = rawUrl.replace(/['"]/g, "").trim().replace(/\/$/, "");
const supabaseAnonKey = rawKey.replace(/['"]/g, "").trim();

const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

export default function ClientPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [categorieActive, setCategorieActive] = useState("");
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  // Panier & Modals
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [panierOuvert, setPanierOuvert] = useState(false);
  const [produitOuvert, setProduitOuvert] = useState<Produit | null>(null);

  // Sélections Produit
  const [formatChoisi, setFormatChoisi] = useState<FormatOption | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [supplementsCoches, setSupplementsCoches] = useState<Supplement[]>([]);

  // Formulaire Commande
  const [nomClient, setNomClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [noteClient, setNoteClient] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [commandeValidee, setCommandeValidee] = useState(false);
  const [numeroCommande, setNumeroCommande] = useState<number | string | null>(null);

  // 1. Sauvegarde et restauration locale du panier
  useEffect(() => {
    try {
      const savedPanier = localStorage.getItem("hamza_panier");
      if (savedPanier) {
        setPanier(JSON.parse(savedPanier));
      }
    } catch {
      // Ignorer silencieusement si inaccessible
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("hamza_panier", JSON.stringify(panier));
    } catch {
      // Ignorer silencieusement si indisponible
    }
  }, [panier]);

  // 2. Chargement des données
  useEffect(() => {
    async function loadData() {
      if (!supabaseUrl || !supabaseAnonKey) {
        setErreurChargement("Variables d'environnement Supabase manquantes.");
        setChargementDonnees(false);
        return;
      }

      setChargementDonnees(true);
      try {
        const [catRes, prodRes] = await Promise.all([
          supabase.from("categories").select("*").order("id", { ascending: true }),
          supabase.from("produits").select("*").order("id", { ascending: false }),
        ]);

        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;

        if (catRes.data && catRes.data.length > 0) {
          setCategories(catRes.data);
          setCategorieActive(catRes.data[0].nom);
        }

        if (prodRes.data) {
          setProduits(prodRes.data);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Erreur inconnue";
        setErreurChargement(message);
      } finally {
        setChargementDonnees(false);
      }
    }

    loadData();
  }, []);

  // Détection des variantes et suppléments (sécurisé contre les strings JSON)
  const variantesProduitActuel = useMemo<Variante[]>(() => {
    if (!produitOuvert?.variantes) return [];
    if (typeof produitOuvert.variantes === "string") {
      try {
        return JSON.parse(produitOuvert.variantes);
      } catch {
        return [];
      }
    }
    return Array.isArray(produitOuvert.variantes) ? produitOuvert.variantes : [];
  }, [produitOuvert]);

  const supplementsProduitActuel = useMemo<Supplement[]>(() => {
    if (!produitOuvert?.supplements) return [];
    if (typeof produitOuvert.supplements === "string") {
      try {
        return JSON.parse(produitOuvert.supplements);
      } catch {
        return [];
      }
    }
    return Array.isArray(produitOuvert.supplements) ? produitOuvert.supplements : [];
  }, [produitOuvert]);

  // Formats disponibles calculés
  const formatsDisponibles = useMemo<FormatOption[]>(() => {
    if (!produitOuvert) return [];

    const basePrice = Number(produitOuvert.prix) || 0;
    const decants: FormatOption[] = [
      { id: "ml-10", prixUnitaire: basePrice, nom: "Décant 10 ml" },
      { id: "ml-20", prixUnitaire: basePrice * 2, nom: "Décant 20 ml" },
      { id: "ml-30", prixUnitaire: basePrice * 3, nom: "Décant 30 ml" },
      { id: "ml-50", prixUnitaire: basePrice * 5, nom: "Décant 50 ml" },
    ];

    const variantesFlacons: FormatOption[] = variantesProduitActuel.map((v, index) => ({
      id: `var-${index}`,
      prixUnitaire: Number(v.prix) || 0,
      nom: `✨ ${v.nom}`,
    }));

    return [...decants, ...variantesFlacons];
  }, [produitOuvert, variantesProduitActuel]);

  const ouvrirOptionsProduit = (produit: Produit) => {
    setProduitOuvert(produit);
    setFormatChoisi({ id: "ml-10", prixUnitaire: Number(produit.prix) || 0, nom: "Décant 10 ml" });
    setQuantite(1);
    setSupplementsCoches([]);
  };

  const toggleSupplement = (supp: Supplement) => {
    if (supplementsCoches.some((s) => s.nom === supp.nom)) {
      setSupplementsCoches(supplementsCoches.filter((s) => s.nom !== supp.nom));
    } else {
      setSupplementsCoches([...supplementsCoches, supp]);
    }
  };

  const ajouterAuPanierDirect = () => {
    if (!produitOuvert || !formatChoisi) return;

    const nomProduit = produitOuvert.titre || produitOuvert.nom || "Parfum";
    const prixSupps = supplementsCoches.reduce((t, s) => t + Number(s.prix || 0), 0);
    const prixUnitaireTotal = formatChoisi.prixUnitaire + prixSupps;
    const prixTotalLigne = prixUnitaireTotal * quantite;

    // Regroupement d'articles identiques
    const indexExistant = panier.findIndex(
      (item) =>
        item.produit_id === produitOuvert.id &&
        item.formatNom === formatChoisi.nom &&
        JSON.stringify(item.supplements.map((s) => s.nom).sort()) ===
          JSON.stringify(supplementsCoches.map((s) => s.nom).sort())
    );

    if (indexExistant > -1) {
      const nouveauPanier = [...panier];
      const item = nouveauPanier[indexExistant];
      const nouvelleQuantite = item.quantite + quantite;
      nouveauPanier[indexExistant] = {
        ...item,
        quantite: nouvelleQuantite,
        prixTotal: item.prixUnitaire * nouvelleQuantite,
      };
      setPanier(nouveauPanier);
    } else {
      const newItem: PanierItem = {
        idUnique:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        produit_id: produitOuvert.id,
        nom: nomProduit,
        formatNom: formatChoisi.nom,
        prixUnitaire: prixUnitaireTotal,
        prixTotal: prixTotalLigne,
        quantite: quantite,
        supplements: supplementsCoches,
      };
      setPanier((prev) => [...prev, newItem]);
    }

    setProduitOuvert(null);
  };

  const modifierQuantitePanier = (idUnique: string, delta: number) => {
    setPanier((prevPanier) =>
      prevPanier
        .map((item) => {
          if (item.idUnique === idUnique) {
            const nouvelleQte = item.quantite + delta;
            return {
              ...item,
              quantite: nouvelleQte,
              prixTotal: item.prixUnitaire * nouvelleQte,
            };
          }
          return item;
        })
        .filter((item) => item.quantite > 0)
    );
  };

  const retirerDuPanier = (idUnique: string) => {
    const nouveauPanier = panier.filter((item) => item.idUnique !== idUnique);
    setPanier(nouveauPanier);
    if (nouveauPanier.length === 0) setPanierOuvert(false);
  };

  const totalPanier = panier.reduce((total, item) => total + item.prixTotal, 0);
  const nombreArticles = panier.reduce((total, item) => total + item.quantite, 0);

  const handleCommander = async (e: FormEvent) => {
    e.preventDefault();
    if (panier.length === 0) {
      alert("Votre panier est vide !");
      return;
    }
    setEnvoiEnCours(true);

    try {
      let details = panier
        .map((item) => {
          let desc = `- ${item.quantite}x ${item.nom} [Format: ${item.formatNom}] (${item.prixTotal} DA)`;
          if (item.supplements && item.supplements.length > 0) {
            desc += `\n  Extras: ${item.supplements.map((s) => s.nom).join(", ")}`;
          }
          return desc;
        })
        .join("\n\n");

      if (noteClient.trim()) {
        details += `\n\n📝 NOTE CLIENT :\n${noteClient.trim()}`;
      }

      const { data, error } = await supabase
        .from("commandes")
        .insert([
          {
            nom_client: nomClient.trim(),
            telephone_client: telephone.trim(),
            adresse_livraison: adresse.trim(),
            total: totalPanier,
            details_commande: details,
            statut: "en attente",
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setNumeroCommande(data[0].id);
        setCommandeValidee(true);
        setPanier([]);
        setNomClient("");
        setTelephone("");
        setAdresse("");
        setNoteClient("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de connexion";
      alert("Erreur lors de la validation : " + message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const produitsFiltres = produits.filter((p) => p.categorie === categorieActive);

  return (
    <>
      {/* HEADER FIXE + NAVIGATION */}
      <div className="sticky top-0 z-30 bg-[#0A1128]/95 backdrop-blur-md shadow-lg border-b border-[#C59B27]/20">
        <header className="pt-4 pb-3 px-4 flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-[#C59B27] shadow-[0_0_10px_rgba(197,155,39,0.3)] bg-[#111C3A] flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Hamza Parfums"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✨</text></svg>";
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[#C59B27] font-bold text-sm tracking-wide">Hamza Parfum Birtouta</span>
              <span className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold">
                L'Essence de l'Élégance
              </span>
            </div>
          </div>

          <a
            href="tel:0556458402"
            className="flex items-center gap-2 group active:scale-95 transition-transform shrink-0"
            aria-label="Appeler la boutique"
          >
            <span className="text-[#C59B27] font-bold text-[10px] sm:text-xs uppercase tracking-widest text-right leading-tight">
              Contact
            </span>
            <div className="bg-[#111C3A] border border-[#C59B27]/30 w-10 h-10 rounded-full flex items-center justify-center group-hover:border-[#C59B27] shadow-sm transition-colors">
              <span className="text-base" role="img" aria-label="téléphone">
                📞
              </span>
            </div>
          </a>
        </header>

        {/* LISTE DES CATEGORIES */}
        <nav className="flex overflow-x-auto gap-2 px-4 pb-3 max-w-5xl mx-auto scrollbar-none">
          {categories.map((cat) => {
            const isActive = categorieActive === cat.nom;
            return (
              <button
                key={cat.id}
                onClick={() => setCategorieActive(cat.nom)}
                className={`shrink-0 px-4 py-2 rounded-full font-bold uppercase text-xs tracking-wider transition-all border ${
                  isActive
                    ? "bg-[#C59B27] text-[#0A1128] border-[#C59B27] shadow-[0_0_15px_rgba(197,155,39,0.4)]"
                    : "bg-[#111C3A] text-gray-400 border-transparent hover:bg-[#16244A] hover:text-white"
                }`}
              >
                {cat.nom}
              </button>
            );
          })}
        </nav>
      </div>

      {/* CONTENU PRINCIPAL */}
      <main className="p-4 max-w-5xl mx-auto mt-4">
        {erreurChargement && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-4 rounded-2xl mb-6 text-sm">
            ⚠️ {erreurChargement}
          </div>
        )}

        {chargementDonnees ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#111C3A] border border-[#1C2C59] rounded-3xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {produitsFiltres.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <span className="text-4xl block mb-3">🏷️</span>
                <p className="text-sm">Aucun parfum trouvé dans cette catégorie.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {produitsFiltres.map((produit) => (
                  <div
                    key={produit.id}
                    onClick={() => ouvrirOptionsProduit(produit)}
                    className="bg-[#111C3A] border border-[#1C2C59] rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-lg hover:border-[#C59B27]/40 flex flex-col group"
                  >
                    {/* Image du produit */}
                    <div className="w-full aspect-square bg-[#060A17] flex items-center justify-center p-3 relative overflow-hidden">
                      {produit.image_url ? (
                        <img
                          src={produit.image_url}
                          alt={produit.titre || produit.nom || "Parfum"}
                          loading="lazy"
                          className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-5xl opacity-40">✨</div>
                      )}
                    </div>

                    {/* Informations carte */}
                    <div className="p-5 flex-1 flex flex-col justify-between border-t border-[#1C2C59]/50">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white leading-tight">
                            {produit.titre || produit.nom}
                          </h3>
                          <span className="bg-[#C59B27]/10 text-[#C59B27] px-2.5 py-1 rounded-lg font-black text-xs border border-[#C59B27]/20 shrink-0 text-center">
                            {produit.prix} DA
                            <span className="block text-[9px] font-medium opacity-80">/ 10 ml</span>
                          </span>
                        </div>
                        {produit.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed">
                            {produit.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#1C2C59]/40 flex justify-between items-center text-xs text-[#C59B27] font-semibold">
                        <span>Commander & formats</span>
                        <span>➔</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL CONFIGURATION PRODUIT */}
      {produitOuvert && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setProduitOuvert(null)}
        >
          <div
            className="bg-[#0A1128] w-full max-w-md border-t sm:border border-[#1C2C59] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header image du modal */}
            <div className="relative shrink-0 bg-[#060A17] p-4 flex justify-center items-center h-52 border-b border-[#1C2C59]/50">
              {produitOuvert.image_url ? (
                <img
                  src={produitOuvert.image_url}
                  alt={produitOuvert.titre || produitOuvert.nom || "Parfum"}
                  className="w-full h-full object-contain drop-shadow-2xl"
                />
              ) : (
                <span className="text-6xl opacity-30">✨</span>
              )}
              <button
                onClick={() => setProduitOuvert(null)}
                className="absolute top-4 right-4 bg-[#111C3A]/80 backdrop-blur text-gray-300 w-9 h-9 rounded-full flex items-center justify-center font-bold border border-[#1C2C59] hover:bg-[#1C2C59] transition-colors"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Contenu défilant */}
            <div className="p-5 overflow-y-auto space-y-6">
              <h2 className="text-xl font-bold text-white text-center">
                {produitOuvert.titre || produitOuvert.nom}
              </h2>

              {/* Prix dynamique */}
              <div className="bg-[#111C3A] border border-[#C59B27]/30 py-3 rounded-2xl shadow-inner flex flex-col items-center justify-center">
                <p className="text-[#C59B27] font-black text-2xl">
                  {formatChoisi?.prixUnitaire || produitOuvert.prix} DA
                </p>
                <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">
                  {formatChoisi?.nom || "Format standard"}
                </p>
              </div>

              {/* 1. Choix du format */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-3 border-b border-[#1C2C59] pb-2">
                  1. Format & Contenance
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {formatsDisponibles.map((f) => {
                    const estCoche = formatChoisi?.id === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormatChoisi(f)}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center ${
                          estCoche
                            ? "bg-[#C59B27]/10 border-[#C59B27] shadow-[0_0_10px_rgba(197,155,39,0.2)]"
                            : "bg-[#111C3A] border-[#1C2C59] hover:border-[#C59B27]/40"
                        }`}
                      >
                        <span className={`font-bold text-xs ${estCoche ? "text-[#C59B27]" : "text-gray-200"}`}>
                          {f.nom}
                        </span>
                        <span className="text-[#C59B27] font-black text-sm mt-1">{f.prixUnitaire} DA</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Quantité */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-3 border-b border-[#1C2C59] pb-2">
                  2. Quantité
                </h3>
                <div className="flex items-center justify-between bg-[#111C3A] border border-[#1C2C59] rounded-2xl p-2.5">
                  <span className="text-xs font-bold text-gray-400 pl-2">Quantité désirée :</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantite(Math.max(1, quantite - 1))}
                      className="w-9 h-9 rounded-full bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center text-lg font-bold text-[#C59B27] hover:bg-[#16244A] transition-colors"
                    >
                      -
                    </button>
                    <span className="font-black text-white text-base w-6 text-center">{quantite}</span>
                    <button
                      type="button"
                      onClick={() => setQuantite(quantite + 1)}
                      className="w-9 h-9 rounded-full bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center text-lg font-bold text-[#C59B27] hover:bg-[#16244A] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Suppléments / Extras */}
              {supplementsProduitActuel.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#C59B27] mb-3 border-b border-[#1C2C59] pb-2">
                    3. Options & Extras
                  </h3>
                  <div className="space-y-2">
                    {supplementsProduitActuel.map((supp, idx) => {
                      const estCoche = supplementsCoches.some((s) => s.nom === supp.nom);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleSupplement(supp)}
                          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                            estCoche
                              ? "bg-[#C59B27]/10 border-[#C59B27]"
                              : "bg-[#111C3A] border-[#1C2C59] hover:border-[#C59B27]/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md border text-center text-xs flex items-center justify-center shrink-0 font-bold ${
                                estCoche
                                  ? "bg-[#C59B27] border-[#C59B27] text-[#0A1128]"
                                  : "bg-[#0A1128] border-[#1C2C59] text-transparent"
                              }`}
                            >
                              ✓
                            </div>
                            <span className="font-semibold text-white text-xs">{supp.nom}</span>
                          </div>
                          <span className="text-[#C59B27] font-black text-xs">+{supp.prix} DA</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton d'ajout */}
            <div className="p-4 border-t border-[#1C2C59] bg-[#0A1128] shrink-0">
              <button
                type="button"
                onClick={ajouterAuPanierDirect}
                className="w-full bg-[#C59B27] text-[#0A1128] font-black py-4 rounded-2xl uppercase text-xs tracking-wider shadow-[0_0_15px_rgba(197,155,39,0.3)] flex justify-between items-center px-5 transition-transform active:scale-95"
              >
                <span>Ajouter au panier</span>
                <span className="bg-[#0A1128] text-[#C59B27] px-3 py-1 rounded-lg font-black text-xs">
                  {((formatChoisi?.prixUnitaire || 0) +
                    supplementsCoches.reduce((t, s) => t + Number(s.prix || 0), 0)) *
                    quantite}{" "}
                  DA
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOUTON FLOTTANT DU PANIER */}
      {panier.length > 0 && !panierOuvert && !produitOuvert && (
        <button
          onClick={() => setPanierOuvert(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-[#C59B27] text-[#0A1128] font-black py-4 px-5 rounded-2xl shadow-[0_10px_25px_rgba(197,155,39,0.4)] flex justify-between items-center z-40 uppercase tracking-wider text-xs border border-[#C59B27] transition-all hover:scale-[1.02] active:scale-95"
        >
          <span className="bg-[#0A1128] text-[#C59B27] w-7 h-7 flex items-center justify-center rounded-full text-xs font-black">
            {nombreArticles}
          </span>
          <span className="font-bold">Voir mon panier</span>
          <span className="font-black text-sm">{totalPanier} DA</span>
        </button>
      )}

      {/* MODAL DU PANIER COMPLET */}
      {panierOuvert && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setPanierOuvert(false)}
        >
          <div
            className="bg-[#0A1128] w-full max-w-md border-t sm:border border-[#1C2C59] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header panier */}
            <div className="p-4 border-b border-[#1C2C59] flex justify-between items-center bg-[#0A1128] shrink-0">
              <h2 className="text-base font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <span>🛍️</span> Mon Panier
              </h2>
              <button
                onClick={() => setPanierOuvert(false)}
                className="text-gray-400 bg-[#111C3A] border border-[#1C2C59] w-9 h-9 rounded-full flex items-center justify-center font-bold hover:bg-[#16244A] transition-colors"
                aria-label="Fermer le panier"
              >
                ✕
              </button>
            </div>

            {commandeValidee ? (
              /* Vue Confirmation */
              <div className="p-8 text-center overflow-y-auto">
                <span className="text-5xl block mb-4">✨</span>
                <h3 className="text-xl font-black text-[#C59B27] mb-4 uppercase">Commande Transmise !</h3>
                <div className="bg-[#111C3A] border border-[#C59B27]/30 rounded-2xl p-5 mb-6 inline-block shadow-inner">
                  <p className="text-[#C59B27] text-[10px] uppercase tracking-widest mb-1 font-bold">
                    N° de commande
                  </p>
                  <p className="text-4xl font-black text-white">#{numeroCommande}</p>
                </div>
                <p className="text-gray-400 mb-6 text-xs leading-relaxed">
                  Merci pour votre confiance. Nous vous contacterons rapidement par téléphone pour confirmer la
                  livraison.
                </p>
                <button
                  onClick={() => {
                    setCommandeValidee(false);
                    setPanierOuvert(false);
                    setNumeroCommande(null);
                  }}
                  className="bg-[#C59B27] text-[#0A1128] font-bold py-3.5 px-6 rounded-2xl uppercase text-xs w-full transition-transform active:scale-95"
                >
                  Retour à la boutique
                </button>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto flex-1 space-y-6">
                {/* Liste des articles */}
                <div className="space-y-3">
                  {panier.map((item) => (
                    <div
                      key={item.idUnique}
                      className="bg-[#111C3A] border border-[#1C2C59] p-3.5 rounded-2xl shadow-sm flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-white text-sm leading-snug">{item.nom}</h4>
                          <p className="text-xs text-[#C59B27] mt-0.5 font-medium">{item.formatNom}</p>
                          {item.supplements && item.supplements.length > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Extras: {item.supplements.map((s) => s.nom).join(", ")}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => retirerDuPanier(item.idUnique)}
                          className="text-red-400 bg-red-500/10 p-2 rounded-xl hover:bg-red-500/20 transition-colors text-xs"
                          title="Supprimer la ligne"
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="flex justify-between items-center border-t border-[#1C2C59]/40 pt-2 mt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => modifierQuantitePanier(item.idUnique, -1)}
                            className="w-7 h-7 rounded-lg bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center font-bold text-sm text-[#C59B27]"
                          >
                            -
                          </button>
                          <span className="font-black text-white text-xs w-4 text-center">{item.quantite}</span>
                          <button
                            type="button"
                            onClick={() => modifierQuantitePanier(item.idUnique, 1)}
                            className="w-7 h-7 rounded-lg bg-[#0A1128] border border-[#1C2C59] flex items-center justify-center font-bold text-sm text-[#C59B27]"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-white font-black text-sm">{item.prixTotal} DA</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Résumé et formulaire */}
                <div className="border-t border-[#1C2C59] pt-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-semibold text-sm">Total à payer :</span>
                    <span className="text-4xl font-black text-[#C59B27]">{totalPanier} DA</span>
                  </div>

                  <form onSubmit={handleCommander} className="space-y-4">
                    <input
                      type="text"
                      required
                      placeholder="Nom complet"
                      value={nomClient}
                      onChange={(e) => setNomClient(e.target.value)}
                      className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="N° Téléphone"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500"
                    />
                    <textarea
                      required
                      rows={2}
                      placeholder="Adresse complète (ex: Birtouta, Centre)..."
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] placeholder-gray-500"
                    />
                    <textarea
                      rows={2}
                      placeholder="Remarque (Optionnel)"
                      value={noteClient}
                      onChange={(e) => setNoteClient(e.target.value)}
                      className="w-full bg-[#111C3A] text-white border border-transparent rounded-2xl p-4 outline-none focus:border-[#C59B27] text-sm placeholder-gray-500"
                    />
                    <button
                      type="submit"
                      disabled={envoiEnCours}
                      className="w-full bg-[#C59B27] text-[#0A1128] font-black py-5 rounded-2xl uppercase text-sm mt-2 disabled:opacity-70 transition-transform active:scale-95 shadow-[0_0_15px_rgba(197,155,39,0.3)]"
                    >
                      {envoiEnCours ? "Transmission..." : "✨ Confirmer la commande"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}