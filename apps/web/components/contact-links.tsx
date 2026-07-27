const DEFAULT_EMAIL = "handydan@whatisthis.place";
const DEFAULT_PHONE_NUMBER = "+13435961813";
const DEFAULT_WHATSAPP_URL = "https://wa.me/13435961813";
const DEFAULT_FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61592466245543";
const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/digitalhandydan/";

type ContactIconName = "email" | "facebook" | "instagram" | "phone" | "whatsapp";

function ContactIcon({ name }: { name: ContactIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "email" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" {...common} />
          <path d="m4 7 8 6 8-6" {...common} />
        </>
      )}
      {name === "facebook" && (
        <path
          fill="currentColor"
          d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.5V13h2.8v8h3.4Z"
        />
      )}
      {name === "instagram" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" {...common} />
          <circle cx="12" cy="12" r="4" {...common} />
          <circle cx="17.4" cy="6.7" r="1" fill="currentColor" />
        </>
      )}
      {name === "phone" && (
        <path d="M7.2 3.8 9.6 7l-2 2.1a15.6 15.6 0 0 0 7.3 7.3l2.1-2 3.2 2.4-1.1 3.1c-.3.8-1.1 1.2-1.9 1.1C9.8 20 4 14.2 3 6.8c-.1-.8.3-1.6 1.1-1.9l3.1-1.1Z" {...common} />
      )}
      {name === "whatsapp" && (
        <>
          <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.3a8.5 8.5 0 1 1 15.6-4.5Z" {...common} />
          <path d="M8.1 7.8c.2-.4.5-.4.8-.4h.4l1.1 2.4c.1.3 0 .5-.1.7l-.8 1c.8 1.7 2.1 3 3.8 3.8l1-.8c.2-.2.5-.2.7-.1l2.4 1.1v.4c0 .3 0 .6-.4.8-.5.3-1.5.7-2.4.5-3.9-.8-7-3.9-7.8-7.8-.2-.9.2-1.9.5-2.4Z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function ContactLinks({
  className = "",
  title = "Contact Digital HandyDan",
}: {
  className?: string;
  title?: string;
}) {
  const email = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || DEFAULT_EMAIL;
  const phoneNumber = process.env.NEXT_PUBLIC_PHONE_NUMBER || DEFAULT_PHONE_NUMBER;
  const links = [
    {
      label: "Facebook",
      icon: "facebook" as const,
      href: process.env.NEXT_PUBLIC_FACEBOOK_URL
        || process.env.NEXT_PUBLIC_MESSENGER_URL
        || DEFAULT_FACEBOOK_URL,
    },
    {
      label: "Instagram",
      icon: "instagram" as const,
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || DEFAULT_INSTAGRAM_URL,
    },
    {
      label: "Email",
      icon: "email" as const,
      href: `mailto:${email}`,
    },
    {
      label: "WhatsApp",
      icon: "whatsapp" as const,
      href: process.env.NEXT_PUBLIC_WHATSAPP_URL || DEFAULT_WHATSAPP_URL,
    },
    {
      label: "Phone",
      icon: "phone" as const,
      href: `tel:${phoneNumber}`,
    },
  ];

  return (
    <section className={`account-contact ${className}`.trim()}>
      <h2>{title}</h2>
      <div>
        {links.map((link) => {
          const external = link.href.startsWith("http");
          return (
            <a
              key={link.label}
              href={link.href}
              aria-label={link.label}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
            >
              <span>
                <ContactIcon name={link.icon} />
              </span>
              {link.label}
            </a>
          );
        })}
      </div>
    </section>
  );
}
