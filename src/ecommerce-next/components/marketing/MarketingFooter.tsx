'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin, Linkedin, Twitter, Youtube, Github } from 'lucide-react';

const footerLinks = {
  prodotto: [
    { href: '/features', label: 'Funzionalita' },
    { href: '/pricing', label: 'Prezzi' },
    { href: '/integrations', label: 'Integrazioni' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/roadmap', label: 'Roadmap' },
  ],
  risorse: [
    { href: '/blog', label: 'Blog' },
    { href: '/docs', label: 'Documentazione' },
    { href: '/api', label: 'API Reference' },
    { href: '/guides', label: 'Guide' },
    { href: '/webinars', label: 'Webinar' },
  ],
  strumenti: [
    { href: '/tools/roi-calculator', label: 'Calcolatore ROI' },
    { href: '/tools/inventory-checker', label: 'Checker Inventario' },
    { href: '/tools/invoice-generator', label: 'Generatore Fattura' },
  ],
  azienda: [
    { href: '/about', label: 'Chi Siamo' },
    { href: '/contact', label: 'Contatti' },
    { href: '/careers', label: 'Lavora con Noi' },
    { href: '/partners', label: 'Partner' },
  ],
  legale: [
    { href: '/legal/privacy', label: 'Privacy Policy' },
    { href: '/legal/terms', label: 'Termini di Servizio' },
    { href: '/legal/cookies', label: 'Cookie Policy' },
    { href: '/legal/gdpr', label: 'GDPR' },
  ],
};

const socialLinks = [
  { href: 'https://linkedin.com/company/fabbricami', icon: Linkedin, label: 'LinkedIn' },
  { href: 'https://twitter.com/fabbricami', icon: Twitter, label: 'Twitter' },
  { href: 'https://youtube.com/@fabbricami', icon: Youtube, label: 'YouTube' },
  { href: 'https://github.com/fabbricami', icon: Github, label: 'GitHub' },
];

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">F</span>
              </div>
              <span className="text-xl font-bold">Fabbricami</span>
            </Link>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              L&apos;ERP completo per e-commerce. Gestisci inventario, ordini, produzione e contabilita in un&apos;unica piattaforma.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 text-sm">
              <a
                href="mailto:info@fabbricami.pro"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4" />
                info@fabbricami.pro
              </a>
              <a
                href="tel:+390123456789"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Phone className="w-4 h-4" />
                +39 012 345 6789
              </a>
              <div className="flex items-start gap-2 text-gray-400">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span>Milano, Italia</span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Prodotto
            </h4>
            <ul className="space-y-3">
              {footerLinks.prodotto.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Risorse
            </h4>
            <ul className="space-y-3">
              {footerLinks.risorse.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Strumenti Gratuiti
            </h4>
            <ul className="space-y-3">
              {footerLinks.strumenti.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Azienda
            </h4>
            <ul className="space-y-3">
              {footerLinks.azienda.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">
              Legale
            </h4>
            <ul className="space-y-3">
              {footerLinks.legale.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-gray-500 text-sm">
              © {currentYear} Fabbricami. Tutti i diritti riservati.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-medium text-green-400 bg-green-500/10 rounded-full">
                GDPR Compliant
              </span>
              <span className="px-3 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-full">
                SSL Secured
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
