import {
  Baby,
  BookOpen,
  Car,
  CookingPot,
  CupSoda,
  Dumbbell,
  Gem,
  Headphones,
  HeartPulse,
  Laptop,
  PawPrint,
  Refrigerator,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Tag,
  Watch,
} from "lucide-react";
import { normalize } from "./libreville";

// Icône SVG d'un rayon d'après son nom (les rayons sont créés librement dans l'admin) :
// le site n'affiche plus d'emojis. L'ordre compte : « électroménager » avant « électronique ».
const RULES = [
  [/beaut|cosmet|maquill|parfum|soin|hygien/, Sparkles],
  [/electromenager/, Refrigerator],
  [/telephon|smartphone|mobile/, Smartphone],
  [/informati|ordinat|laptop/, Laptop],
  [/electroni|audio|hi-?fi|high-?tech|gaming/, Headphones],
  [/maison|deco|meubl|lumin|interieur/, Sofa],
  [/cuisine|ustensil/, CookingPot],
  [/boisson|jus|soda/, CupSoda],
  [/epicer|aliment|nourrit|food|course|marche/, ShoppingBasket],
  [/montre/, Watch],
  [/bijou|accessoir/, Gem],
  [/mode|vetement|habit|chauss|textile|pagne/, Shirt],
  [/sport|fitness|muscu/, Dumbbell],
  [/enfant|bebe|jouet|kids|puericult/, Baby],
  [/sante|pharma|bien-?etre/, HeartPulse],
  [/livre|papeter|bureau|scolaire|ecole|fourniture/, BookOpen],
  [/auto|moto|voiture|vehicul/, Car],
  [/jardin|plante|fleur/, Sprout],
  [/animal|animaux|chien|chat/, PawPrint],
];

export function categoryIcon(name, fallback = Tag) {
  const n = normalize(name);
  return RULES.find(([re]) => re.test(n))?.[1] || fallback;
}
