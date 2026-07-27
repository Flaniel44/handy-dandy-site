const DEFAULT_EMAIL = "handydan@whatisthis.place";
const DEFAULT_WHATSAPP_URL = "https://wa.me/13435961813";
const DEFAULT_FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61592466245543";
const DEFAULT_INSTAGRAM_URL = "https://www.instagram.com/digitalhandydan/";

export function ContactLinks() {
  const email = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || DEFAULT_EMAIL;
  const links = [
    {
      label: "WhatsApp",
      icon: "WA",
      href: process.env.NEXT_PUBLIC_WHATSAPP_URL || DEFAULT_WHATSAPP_URL,
    },
    {
      label: "Email",
      icon: "✉",
      href: `mailto:${email}`,
    },
    {
      label: "Facebook",
      icon: "f",
      href: process.env.NEXT_PUBLIC_FACEBOOK_URL
        || process.env.NEXT_PUBLIC_MESSENGER_URL
        || DEFAULT_FACEBOOK_URL,
    },
    {
      label: "Instagram",
      icon: "◎",
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || DEFAULT_INSTAGRAM_URL,
    },
  ];

  return (
    <section className="account-contact">
      <h2>Contact Digital HandyDan</h2>
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
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </a>
          );
        })}
      </div>
    </section>
  );
}
