// État d'une boutique (validation par l'admin), affiché au vendeur et dans l'admin
export const SHOP_STATUS = {
  pending: {
    label: "En attente de validation",
    cls: "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300",
  },
  active: {
    label: "En ligne",
    cls: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  },
  rejected: {
    label: "Refusée",
    cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  suspended: {
    label: "Suspendue",
    cls: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300",
  },
};
