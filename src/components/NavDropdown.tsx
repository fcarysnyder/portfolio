// src/components/NavDropdown.tsx

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { List } from 'phosphor-react';
import { useState, useEffect } from 'react';

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

  const handleOpenChange = (newOpenState: boolean) => {
    setOpen(newOpenState);
  };

  // Client-side check function that safely uses the window property
  const checkIsCurrentPage = (href: string): boolean => {
    if (typeof window !== 'undefined' && window.isCurrentPageClient) {
      return window.isCurrentPageClient(href);
    }
    return false; // Default if function not available
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger
        className="menu-button"
        aria-label="Menu"
      >
        <span className="sr-only">Menu</span>
        <List size={16} />
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

// Styles
const styles = `
  .menu-button {
    position: relative;
    display: flex;
    border: 0;
    border-radius: 999rem;
    padding: 0.5rem;
    font-size: 1.5rem;
    color: var(--accent-dark);
    background: var(--gray-999);
    cursor: pointer;
  }

  .menu-button:focus {
    outline: none !important;
  }

  .menu-button[data-state='open'] { /* Radix uses data-state for open/closed */
    color: var(--accent-dark);
    background: var(--gray-999);
  }

  [data-theme='light'] .menu-button[data-state='open'] {
    color: var(--accent-light);
  }

  .menu-content {
    background-color: var(--gray-999);
    border: 1px solid var(--gray-800);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    box-sizing: border-box; /* Added for predictable sizing */
    min-width: 200px; /* Added to ensure minimum readability */
    max-width: 280px; /* Added to prevent excessive width and potential overflow */
  }

  .nav-items {
    margin: 0;
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
    line-height: 150%;
    list-style: none;
    padding: 8px;
    gap: 4px;
    border: none !important;
  }

  .link {
    display: block; /* Make the whole area clickable */
    color: var(--gray-300);
    text-decoration: none;
    padding: 0.5rem 1rem; /* Adjust padding for better click area */
    border-radius: 0.25rem;
    border: none !important;
  }

  .link:hover {
    background-color: var(--accent-overlay-hover);
    color: var(--accent-dark); /* Optional: change text color on hover */
    border: none !important;
  }

  .link[data-highlighted] {
    outline: none !important;
    border: none !important;
  }

  .link[aria-current] {
    color: var(--accent-dark);
    font-weight: bold; /* Optional: make current link bolder */
    border: none !important;
  }

  html body[data-scroll-locked] {
    margin-right: 0px !important;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}