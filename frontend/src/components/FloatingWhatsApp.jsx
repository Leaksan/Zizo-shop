import { useShop } from "../context/ShopContext";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";

export default function FloatingWhatsApp() {
  const { shopPhone } = useShop();
  if (!shopPhone) return null;
  return (
    <a
      href={whatsappUrl(shopPhone, "Bonjour, j'ai une question sur MaBoutique 👋")}
      target="_blank"
      rel="noopener noreferrer"
      title="Nous contacter sur WhatsApp"
      className="whatsapp-fab fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-green-500/30 transition hover:scale-110 hover:shadow-2xl"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
