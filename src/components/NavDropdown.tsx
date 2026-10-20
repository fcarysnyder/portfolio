// src/components/NavDropdown.tsx

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu } from 'lucide-react';
import { useRef, useState } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenu.Trigger
        ref={triggerRef}
        className="menu-button icon-control"
        aria-label="Menu"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => handleOpenChange(!open)}
      >
        <span className="sr-only">Menu</span>
        <span className="flex size-8 p-2 text-(length:--text-base)">
          <Menu size="1em" aria-hidden="true" />
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="menu-content z-[1000] max-w-[280px] min-w-[200px] rounded-lg border border-gray-800 bg-gray-999 elevation-lg"
          sideOffset={5}
          align="end"
          collisionPadding={16}
          avoidCollisions={true}
          // Non-modal menus treat a press on the trigger as an outside press and close on pointerdown,
          // then the trigger's own onClick would reopen it. Let onClick alone do the toggle.
          onInteractOutside={(e) => {
            if (triggerRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <ul className="flex flex-col gap-1 border-none p-2 text-sm/[150%]">
            {links.map(({ label, href }) => (
              <li key={href}>
                <DropdownMenu.Item asChild>
                  <a
                    href={href}
                    className="block rounded-sm border-none px-4 py-2 text-gray-300 no-underline hover:bg-accent-overlay-hover hover:text-accent-text-hover data-highlighted:bg-accent-overlay-hover data-highlighted:text-accent-text-hover data-[highlighted]:outline-none aria-[current]:font-bold aria-[current]:text-accent-text"
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