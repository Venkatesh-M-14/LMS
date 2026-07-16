import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import type { LessonVersionStatus } from '@academy/shared';

const COLOR: Record<LessonVersionStatus, 'default' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'default',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

export function VersionStatusChip({ status }: { status: LessonVersionStatus }) {
  const { t } = useTranslation();
  return <Chip size="small" color={COLOR[status]} label={t(`cms.status.${status}`)} />;
}
