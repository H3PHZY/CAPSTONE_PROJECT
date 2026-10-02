import { getDisplayName, getInitials } from "../utils/userDisplay";

const VARIANT_CLASSES = {
  "seller-topbar": "seller-topbar-avatar seller-topbar-avatar-initials",
  marketplace: "marketplace-avatar marketplace-avatar-orange",
  messages: "messages-avatar messages-avatar-orange",
  "account-settings": "account-settings-avatar account-settings-avatar-initials",
  confirmation: "confirmation-user-avatar confirmation-user-avatar-initials",
};

/**
 * @param {{ variant: keyof VARIANT_CLASSES, fullName?: string, initials?: string, imageUrl?: string, className?: string }} props
 */
export default function Avatar({ variant, fullName, initials, imageUrl, className = "" }) {
  const baseClass = VARIANT_CLASSES[variant] ?? "seller-topbar-avatar seller-topbar-avatar-initials";
  const displayName = fullName ?? getDisplayName();
  const letters = initials ?? getInitials(displayName);

  if (imageUrl) {
    const imgClass = variant === "seller-topbar" ? "seller-topbar-avatar" : baseClass.split(" ")[0];
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${imgClass} ${className}`.trim()}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`${baseClass} ${className}`.trim()}
      aria-hidden="true"
      title={displayName}
    >
      {letters}
    </div>
  );
}
