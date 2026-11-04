/* eslint-disable @next/next/no-img-element -- image URLs are arbitrary
   (admin-pasted or AI-generated hosts), so next/image remotePatterns can't
   enumerate them. */

const SIZES = { sm: "h-10 w-10", md: "h-16 w-16", lg: "h-40 w-40", xl: "w-full aspect-square" };

export function Thumb({
  src,
  alt = "",
  size = "sm",
}: {
  src: string | null | undefined;
  alt?: string;
  size?: keyof typeof SIZES;
}) {
  if (!src) return <div className={`${SIZES[size]} shrink-0 rounded-md bg-foreground/10`} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${SIZES[size]} shrink-0 rounded-md bg-foreground/10 object-cover`}
    />
  );
}

export function Avatar({ src, name }: { src: string | null | undefined; name: string }) {
  if (!src) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-medium text-ink-secondary">
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />;
}
