import React from 'react';
const Icon = ({ d, size = 16, fill = 'none', stroke = 'currentColor', strokeWidth = 1.5, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke={stroke} strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const IconSearch = (p) => <Icon {...p}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 L13.5 13.5" /></Icon>;
const IconArrowRight = (p) => <Icon {...p} d="M3 8h10 M9 4l4 4-4 4" />;
const IconExternal = (p) => <Icon {...p}><path d="M10 3h3v3 M13 3L7 9 M12 9v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" /></Icon>;
const IconShield = (p) => <Icon {...p} d="M8 2L3 4v4c0 3 2 5 5 6 3-1 5-3 5-6V4z" />;
const IconCpu = (p) => <Icon {...p}><rect x="4" y="4" width="8" height="8" rx="1" /><path d="M6 4V2 M10 4V2 M6 14v-2 M10 14v-2 M4 6H2 M4 10H2 M14 6h-2 M14 10h-2" /></Icon>;
const IconInfo = (p) => <Icon {...p}><circle cx="8" cy="8" r="6.5"/><path d="M8 7.5v3.5 M8 5.1v.1"/></Icon>;
const IconZap = (p) => <Icon {...p}><path d="M9 1L3 9h3v6l6-8h-3z" /></Icon>;
const fmt = (n) => {
  if (n == null) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/,'') + 'k';
  return String(n);
};

export const XIcons = { IconArrowRight, IconCpu, IconExternal, IconInfo, IconSearch, IconShield, IconZap };
export const XPrim = { fmt };
