import Link from 'next/link';

const footerLinks = {
  explore: [
    { href: '/', label: 'All Properties' },
    { href: '/browse-by-area', label: 'Browse by Area' },
    { href: '/guides', label: 'Property Guides' },
    { href: '/find-property', label: 'Find Property' },
  ],
  company: [
    { href: '/about', label: 'About Us' },
    { href: '/list-your-property', label: 'List Your Property' },
    { href: '/disclaimer', label: 'Disclaimer' },
  ],
  legal: [
    { href: '/disclaimer', label: 'Terms of Use' },
    { href: '/takedown', label: 'Takedown Request' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-lg text-foreground">Property.com.ve</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Your trusted source for Venezuelan real estate listings from multiple sources.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Explore</h3>
            <ul className="space-y-2">
              {footerLinks.explore.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} Property.com.ve. All rights reserved.
            <span className="block mt-1">
              We aggregate listings from third-party sources. Always verify with the original listing.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
