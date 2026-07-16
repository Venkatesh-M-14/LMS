import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link as RouterLink } from 'react-router';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import PublishIcon from '@mui/icons-material/Publish';
import UndoIcon from '@mui/icons-material/Undo';
import { useTranslation } from 'react-i18next';
import {
  ContentBlockTypes,
  type ContentBlockDto,
  type ContentBlockInput,
  type ContentBlockType,
  type LessonVersionSummary,
} from '@academy/shared';
import { useAppSelector } from '../../app/hooks';
import { ApiClientError } from '../../shared/api/client';
import { BlockRenderer } from '../curriculum/components/BlockRenderer';
import { curriculumKeys } from '../curriculum/api';
import {
  cmsKeys,
  createDraft,
  fetchSkills,
  fetchVersionDetail,
  fetchVersions,
  publishVersion,
  rejectVersion,
  replaceBlocks,
  setLessonSkills,
  submitVersion,
  fetchCmsLessons,
} from './api';
import { VersionStatusChip } from './components/VersionStatusChip';
import { BlockEditorItem, defaultBlock } from './components/BlockEditor';

interface EditableBlock {
  key: string;
  value: ContentBlockInput;
}

let blockKeyCounter = 0;
const nextKey = () => `block-${++blockKeyCounter}`;

function toEditable(blocks: ContentBlockDto[]): EditableBlock[] {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      key: nextKey(),
      value: { type: block.type, payload: block.payload } as ContentBlockInput,
    }));
}

function toPreviewDtos(blocks: EditableBlock[]): ContentBlockDto[] {
  return blocks.map((block, index) => ({
    id: block.key,
    order: index + 1,
    type: block.value.type,
    payload: block.value.payload,
    payloadSchemaVersion: 1,
  }));
}

const CMS_ERROR_CODES = new Set([
  'VERSION_NOT_EDITABLE',
  'INVALID_STATUS_TRANSITION',
  'OPEN_DRAFT_EXISTS',
  'REVIEWER_CANNOT_BE_AUTHOR',
  'SKILLS_REQUIRED_TO_PUBLISH',
  'EMPTY_VERSION_CANNOT_ADVANCE',
  'VALIDATION_FAILED',
  'CONFLICT',
]);

export function LessonEditorPage() {
  const { t } = useTranslation();
  const { lessonId = '' } = useParams();
  const queryClient = useQueryClient();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const versionsQuery = useQuery({
    queryKey: cmsKeys.versions(lessonId),
    queryFn: () => fetchVersions(lessonId),
    enabled: lessonId.length > 0,
  });

  const lessonsQuery = useQuery({ queryKey: cmsKeys.lessons, queryFn: fetchCmsLessons });
  const lesson = useMemo(
    () => lessonsQuery.data?.find((l) => l.id === lessonId) ?? null,
    [lessonsQuery.data, lessonId],
  );

  const skillsQuery = useQuery({ queryKey: cmsKeys.skills, queryFn: fetchSkills });

  const activeVersionId = selectedVersionId ?? versionsQuery.data?.[0]?.id ?? null;
  const detailQuery = useQuery({
    queryKey: cmsKeys.version(activeVersionId ?? 'none'),
    queryFn: () => fetchVersionDetail(activeVersionId!),
    enabled: activeVersionId !== null,
  });
  const detail = detailQuery.data ?? null;

  // Load server blocks into the editor whenever a (re)fetched version arrives
  // and there are no unsaved local edits to protect.
  useEffect(() => {
    if (detail && !dirty) {
      setBlocks(toEditable(detail.blocks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.updatedAt]);

  const errorMessage = (error: unknown): string => {
    if (error instanceof ApiClientError && CMS_ERROR_CODES.has(error.code)) {
      return error.message; // server messages for the authoring audience are precise
    }
    return t('cms.actionFailed');
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: cmsKeys.versions(lessonId) }),
      queryClient.invalidateQueries({ queryKey: cmsKeys.lessons }),
      activeVersionId
        ? queryClient.invalidateQueries({ queryKey: cmsKeys.version(activeVersionId) })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: curriculumKeys.pathTree }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      replaceBlocks(
        activeVersionId!,
        blocks.map((b) => b.value),
      ),
    onSuccess: async () => {
      setDirty(false);
      setActionError(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const workflowMutation = useMutation({
    mutationFn: async (action: 'submit' | 'publish' | 'reject' | 'draft') => {
      switch (action) {
        case 'submit':
          return submitVersion(activeVersionId!);
        case 'publish':
          return publishVersion(activeVersionId!);
        case 'reject':
          return rejectVersion(activeVersionId!, rejectNotes);
        case 'draft':
          return createDraft(lessonId, '');
      }
    },
    onSuccess: async (result, action) => {
      setActionError(null);
      setRejectOpen(false);
      setRejectNotes('');
      setDirty(false);
      await invalidate();
      if (action === 'draft' && result && 'id' in result) {
        setSelectedVersionId(result.id);
      }
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const skillsMutation = useMutation({
    mutationFn: (skillIds: string[]) => setLessonSkills(lessonId, skillIds),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  if (versionsQuery.isPending || lessonsQuery.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (versionsQuery.isError || !lesson) {
    return <Alert severity="error">{t('curriculum.loadError')}</Alert>;
  }

  const versions: LessonVersionSummary[] = versionsQuery.data ?? [];
  const isDraft = detail?.status === 'DRAFT';
  const isInReview = detail?.status === 'IN_REVIEW';
  const hasOpenVersion = versions.some((v) => v.status === 'DRAFT' || v.status === 'IN_REVIEW');
  const canPublish =
    isInReview &&
    currentUser != null &&
    (currentUser.role === 'ADMIN' || currentUser.id !== detail?.authorId);

  const updateBlock = (index: number, value: ContentBlockInput) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, value } : b)));
    setDirty(true);
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + direction, 0, item!);
      return next;
    });
    setDirty(true);
  };
  const deleteBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };
  const addBlock = (type: ContentBlockType) => {
    setBlocks((prev) => [...prev, { key: nextKey(), value: defaultBlock(type) }]);
    setDirty(true);
    setAddMenuAnchor(null);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button component={RouterLink} to="/instructor" startIcon={<ArrowBackIcon />}>
          {t('cms.backToLessons')}
        </Button>
        <Typography variant="h2" component="h1" sx={{ flexGrow: 1 }}>
          {lesson.title}
        </Typography>
      </Stack>

      {actionError ? (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
        {/* Main column */}
        <Stack spacing={2} sx={{ flex: 2, width: '100%' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {versions.map((version) => (
              <Chip
                key={version.id}
                label={`v${version.versionNumber}`}
                variant={version.id === activeVersionId ? 'filled' : 'outlined'}
                color={version.id === activeVersionId ? 'primary' : 'default'}
                onClick={() => {
                  setSelectedVersionId(version.id);
                  setDirty(false);
                }}
              />
            ))}
            {!hasOpenVersion ? (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => workflowMutation.mutate('draft')}
                disabled={workflowMutation.isPending}
              >
                {t('cms.newDraft')}
              </Button>
            ) : null}
            <Box sx={{ flexGrow: 1 }} />
            {detail ? <VersionStatusChip status={detail.status} /> : null}
          </Stack>

          {detail ? (
            <>
              {isDraft ? (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={mode}
                  onChange={(_e, value: 'edit' | 'preview' | null) => value && setMode(value)}
                  aria-label={t('cms.viewMode')}
                >
                  <ToggleButton value="edit">{t('cms.edit')}</ToggleButton>
                  <ToggleButton value="preview">{t('cms.preview')}</ToggleButton>
                </ToggleButtonGroup>
              ) : null}

              {isDraft && mode === 'edit' ? (
                <Stack spacing={2}>
                  {blocks.map((block, index) => (
                    <BlockEditorItem
                      key={block.key}
                      index={index}
                      total={blocks.length}
                      block={block.value}
                      onChange={(value) => updateBlock(index, value)}
                      onMove={(direction) => moveBlock(index, direction)}
                      onDelete={() => deleteBlock(index)}
                    />
                  ))}
                  <Box>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={(e) => setAddMenuAnchor(e.currentTarget)}
                    >
                      {t('cms.addBlock')}
                    </Button>
                    <Menu
                      anchorEl={addMenuAnchor}
                      open={Boolean(addMenuAnchor)}
                      onClose={() => setAddMenuAnchor(null)}
                    >
                      {ContentBlockTypes.map((type) => (
                        <MenuItem key={type} onClick={() => addBlock(type)}>
                          {t(`cms.blocks.types.${type}`)}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>
                  <BlockRenderer
                    blocks={mode === 'preview' && isDraft ? toPreviewDtos(blocks) : detail.blocks}
                  />
                </Paper>
              )}
            </>
          ) : null}
        </Stack>

        {/* Sidebar */}
        <Stack
          spacing={2}
          sx={{ flex: 1, width: '100%', position: { md: 'sticky' }, top: { md: 88 } }}
        >
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('cms.workflow')}
            </Typography>
            <Stack spacing={1}>
              {isDraft ? (
                <>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={!dirty || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    {dirty ? t('cms.save') : t('cms.saved')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    disabled={dirty || workflowMutation.isPending}
                    onClick={() => workflowMutation.mutate('submit')}
                  >
                    {t('cms.submitForReview')}
                  </Button>
                  {dirty ? (
                    <Typography variant="caption" color="text.secondary">
                      {t('cms.saveBeforeSubmit')}
                    </Typography>
                  ) : null}
                </>
              ) : null}
              {isInReview ? (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PublishIcon />}
                    disabled={!canPublish || workflowMutation.isPending}
                    onClick={() => workflowMutation.mutate('publish')}
                  >
                    {t('cms.publish')}
                  </Button>
                  {!canPublish ? (
                    <Typography variant="caption" color="text.secondary">
                      {t('cms.fourEyes')}
                    </Typography>
                  ) : null}
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<UndoIcon />}
                    disabled={workflowMutation.isPending}
                    onClick={() => setRejectOpen(true)}
                  >
                    {t('cms.requestChanges')}
                  </Button>
                </>
              ) : null}
              {detail && !isDraft && !isInReview ? (
                <Typography variant="body2" color="text.secondary">
                  {t('cms.readOnlyVersion')}
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('cms.versionInfo')}
            </Typography>
            {detail ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  {t('cms.author')}: {detail.authorName}
                </Typography>
                {detail.reviewerName ? (
                  <Typography variant="body2">
                    {t('cms.reviewer')}: {detail.reviewerName}
                  </Typography>
                ) : null}
                {detail.changelog ? (
                  <Typography variant="body2" color="text.secondary">
                    {detail.changelog}
                  </Typography>
                ) : null}
                {detail.reviewNotes ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {detail.reviewNotes}
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('cms.skills')}
            </Typography>
            <Autocomplete
              multiple
              size="small"
              options={skillsQuery.data ?? []}
              getOptionLabel={(skill) => skill.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={lesson.skills}
              onChange={(_e, value) => skillsMutation.mutate(value.map((skill) => skill.id))}
              renderInput={(params) => (
                <TextField {...params} placeholder={t('cms.skillsPlaceholder')} />
              )}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {t('cms.skillsHelp')}
            </Typography>
          </Paper>

          <Divider />
          <Button component={RouterLink} to={`/lessons/${lessonId}`} size="small">
            {t('cms.viewAsStudent')}
          </Button>
        </Stack>
      </Stack>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('cms.requestChanges')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            sx={{ mt: 1 }}
            label={t('cms.reviewNotes')}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={rejectNotes.trim().length < 3 || workflowMutation.isPending}
            onClick={() => workflowMutation.mutate('reject')}
          >
            {t('cms.requestChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
