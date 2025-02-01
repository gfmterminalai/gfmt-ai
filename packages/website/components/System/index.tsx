// This will be our own implementation of the SRCL components
import React from 'react';

export const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="page">{children}</div>
);

export const Navigation: React.FC<{
  items: Array<{ id: string; label: string; href: string }>
}> = ({ items }) => (
  <nav className="navigation">
    {items.map((item) => (
      <a key={item.id} href={item.href}>
        {item.label}
      </a>
    ))}
  </nav>
);

export const Text: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div className="text" style={style}>
    {children}
  </div>
);

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ children, onClick }) => (
  <button className="button" onClick={onClick}>
    {children}
  </button>
); 