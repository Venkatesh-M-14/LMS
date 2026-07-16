import type { SvgIconProps } from '@mui/material/SvgIcon';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import QuizIcon from '@mui/icons-material/Quiz';
import VerifiedIcon from '@mui/icons-material/Verified';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import SchoolIcon from '@mui/icons-material/School';
import StarIcon from '@mui/icons-material/Star';

/** Maps achievement icon keys (from the server) to MUI icons. */
const ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  Footprint: DirectionsWalkIcon,
  Quiz: QuizIcon,
  Verified: VerifiedIcon,
  RocketLaunch: RocketLaunchIcon,
  LocalFireDepartment: LocalFireDepartmentIcon,
  Whatshot: WhatshotIcon,
  School: SchoolIcon,
  Star: StarIcon,
  EmojiEvents: EmojiEventsIcon,
};

export function AchievementIcon({ icon, ...props }: { icon: string } & SvgIconProps) {
  const Icon = ICONS[icon] ?? EmojiEventsIcon;
  return <Icon {...props} />;
}
