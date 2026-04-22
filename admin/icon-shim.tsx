import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function createIcon(label: string) {
  return function Icon({ size = 16, className, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        <title>{label}</title>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    );
  };
}

export const Activity = createIcon('Activity');
export const AlertCircle = createIcon('AlertCircle');
export const AlertTriangle = createIcon('AlertTriangle');
export const ArrowLeft = createIcon('ArrowLeft');
export const ArrowRight = createIcon('ArrowRight');
export const Check = createIcon('Check');
export const CheckIcon = createIcon('CheckIcon');
export const ChevronDownIcon = createIcon('ChevronDownIcon');
export const ChevronLeftIcon = createIcon('ChevronLeftIcon');
export const ChevronRight = createIcon('ChevronRight');
export const ChevronRightIcon = createIcon('ChevronRightIcon');
export const ChevronUpIcon = createIcon('ChevronUpIcon');
export const CircleCheckIcon = createIcon('CircleCheckIcon');
export const CircleIcon = createIcon('CircleIcon');
export const Cpu = createIcon('Cpu');
export const InfoIcon = createIcon('InfoIcon');
export const LayoutDashboard = createIcon('LayoutDashboard');
export const Clock = createIcon('Clock');
export const Menu = createIcon('Menu');
export const Copy = createIcon('Copy');
export const Gift = createIcon('Gift');
export const Globe = createIcon('Globe');
export const Grid3X3 = createIcon('Grid3X3');
export const GripVerticalIcon = createIcon('GripVerticalIcon');
export const Heart = createIcon('Heart');
export const Hourglass = createIcon('Hourglass');
export const Image = createIcon('Image');
export const Key = createIcon('Key');
export const List = createIcon('List');
export const Loader2Icon = createIcon('Loader2Icon');
export const LogOut = createIcon('LogOut');
export const Mail = createIcon('Mail');
export const Maximize2 = createIcon('Maximize2');
export const MinusIcon = createIcon('MinusIcon');
export const MoreHorizontal = createIcon('MoreHorizontal');
export const MoreHorizontalIcon = createIcon('MoreHorizontalIcon');
export const OctagonXIcon = createIcon('OctagonXIcon');
export const PanelLeftIcon = createIcon('PanelLeftIcon');
export const Plus = createIcon('Plus');
export const Ratio = createIcon('Ratio');
export const Save = createIcon('Save');
export const Search = createIcon('Search');
export const SearchIcon = createIcon('SearchIcon');
export const Settings = createIcon('Settings');
export const Shield = createIcon('Shield');
export const Shuffle = createIcon('Shuffle');
export const Sliders = createIcon('Sliders');
export const ToggleLeft = createIcon('ToggleLeft');
export const ToggleRight = createIcon('ToggleRight');
export const Trash2 = createIcon('Trash2');
export const TrendingUp = createIcon('TrendingUp');
export const User = createIcon('User');
export const UserCircle = createIcon('UserCircle');
export const UserCheck = createIcon('UserCheck');
export const UserX = createIcon('UserX');
export const Users = createIcon('Users');
export const TriangleAlertIcon = createIcon('TriangleAlertIcon');
export const X = createIcon('X');
export const XIcon = createIcon('XIcon');
export const Zap = createIcon('Zap');
