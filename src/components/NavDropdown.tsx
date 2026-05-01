// src/components/NavDropdown.tsx

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import '../styles/global.css';

interface NavDropdownProps {
  links: { label: string; href: string }[];
  isCurrentPage?: (href: string) => boolean;
}

// Extend window type for TypeScript to recognize isCurrentPageClient
declare global {
  interface Window {
    isCurrentPageClient?: (href: string) => boolean;
  }
}

export default function NavDropdown({ links }: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  const checkIsCurrentPage = (href: string): boolean => {
    if (typeof window !== 'undefined' && window.isCurrentPageClient) {
      return window.isCurrentPageClient(href);
    }
    return false;
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        const trigger = document.querySelector('.menu-button') as HTMLElement;
        if (trigger && document.activeElement === trigger && !trigger.matches(':focus-visible')) {
          trigger.blur();
        }
      }, 0);
    }
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger
        className="menu-button"
        aria-label="Menu"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="sr-only">Menu</span>
        <Menu size={16} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="menu-content"
          sideOffset={5}
          align="end"
          collisionPadding={16}
          avoidCollisions={true}
        >
          <ul className="nav-items">
            {links.map(({ label, href }) => (
              <li key={href}>
                <DropdownMenu.Item asChild>
                  <a
                    href={href}
                    className="link"
                    aria-current={checkIsCurrentPage(href) ? 'page' : undefined}
                  >
                    {label}
                  </a>
                </DropdownMenu.Item>
              </li>
            ))}
          </ul>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}