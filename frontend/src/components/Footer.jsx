import { Link } from "react-router-dom";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../format";
import { whatsappUrl } from "../whatsapp";

export default function Footer() {
  const {
    shopName,
    shopPhone,
    pickupAddress,
    freeShippingThreshold,
    currency,
  } = useShop();
  return (
    <footer className="mt-12 border-t border-gray-200 px-4 py-6 text-sm dark:border-slate-700">
      <div className="mx-auto max-w-7xl">
        <details id="infos-boutique" className="scroll-mt-20">
          <summary className="w-fit cursor-pointer font-medium text-gray-600 dark:text-slate-300">
            Informations boutique et aide
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 muted">
              <p>{shopName} · Libreville, Gabon</p>
              {pickupAddress && <p>Retrait en boutique : {pickupAddress}</p>}
              <p>
                Paiement à la réception. Frais de livraison confirmés avant la
                commande.
              </p>
              {freeShippingThreshold > 0 && (
                <p>
                  Livraison offerte dès{" "}
                  {formatPrice(freeShippingThreshold, currency)} après remise.
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-3">
              {shopPhone && (
                <a
                  href={whatsappUrl(shopPhone, "Bonjour, j’ai besoin d’aide.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:underline dark:text-brand-300"
                >
                  Besoin d’aide ? Écrivez-nous sur WhatsApp
                </a>
              )}
              <Link to="/suivi" className="hover:underline">
                Suivre une commande
              </Link>
              <Link to="/livreur" className="text-xs muted hover:underline">
                Espace livreur
              </Link>
            </div>
          </div>
        </details>
        <p className="mt-5 text-xs muted">
          © {new Date().getFullYear()} {shopName}
        </p>
      </div>
    </footer>
  );
}
