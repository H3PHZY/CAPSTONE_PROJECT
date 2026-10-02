"use client";

type ProfileAvatarProps = {
  name?: string | null;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function initialsOf(name?: string | null) {
  const cleaned = (name || "EL").trim();
  return cleaned.slice(0, 2).toUpperCase();
}

export function ProfileAvatar({
  name,
  url,
  size = "md",
  className = "",
}: ProfileAvatarProps) {
  const sizeClass =
    size === "sm"
      ? "profile-avatar profile-avatar--sm"
      : size === "lg"
        ? "profile-avatar profile-avatar--lg"
        : "profile-avatar";

  if (url) {
    return (
      <span className={`${sizeClass} ${className}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name || "Profile"} />
      </span>
    );
  }

  return (
    <span className={`${sizeClass} ${className}`.trim()} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
