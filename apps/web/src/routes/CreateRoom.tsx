import type { ReactNode } from 'react';
import { useState } from 'react';
import { App, Form, Input, Select, Switch, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { CreateRoomRequest, ParticipantRole, RoomDetail } from '@veyra/contracts';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { CompanyPicker } from '../components/CompanyPicker';
import { CheckCircleIcon, DeleteIcon, PlusIcon, ShieldIcon } from '../components/icons';
import { type CompanyChoice, hasCompany } from '../lib/company';
import { ErrorAlert } from '../components/ErrorAlert';
import { OnboardLayout } from '../components/OnboardLayout';
import { invitationsApi, roomsApi } from '../lib/api/endpoints';
import { messageOf } from '../lib/errorMessage';
import { ROLE_LABELS, ROLE_SHORT } from '../lib/labels';
import { qk } from '../lib/queries';

/**
 * Two steps, and the room exists after the first one (mvp-plan §6) — which is
 * what makes step two skippable rather than a form you're trapped in.
 *
 * Each step owns its own frame rather than sharing one here: they differ in
 * heading, in what the preview panel shows and in where the way back leads, so
 * a shared wrapper would only be a place to pass all three through.
 */
export function CreateRoom() {
  const [room, setRoom] = useState<RoomDetail | null>(null);

  return room ? <InviteStep room={room} /> : <DetailsStep onCreated={setRoom} />;
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

type DetailsValues = {
  name: string;
  ndaRequired: boolean;
  allowDownload: boolean;
  watermarkEnabled: boolean;
};

function DetailsStep({ onCreated }: { onCreated: (room: RoomDetail) => void }) {
  const [form] = Form.useForm<DetailsValues>();
  const [company, setCompany] = useState<CompanyChoice>({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { space } = useVeyraTokens();

  // The panel to the right names the room as you type it, so the field and the
  // preview are the same value rather than a form and a picture of one.
  const name = Form.useWatch('name', form) ?? '';

  const create = useMutation({
    mutationFn: (body: CreateRoomRequest) => roomsApi.create(body),
    onSuccess: async (room) => {
      await queryClient.invalidateQueries({ queryKey: qk.rooms });
      queryClient.setQueryData(qk.room(room.id), room);
      onCreated(room);
    },
  });

  return (
    <OnboardLayout
      step={1}
      stepCount={2}
      title="Create a data room"
      subtitle="One room holds one deal."
      onBack={() => void navigate({ to: '/rooms' })}
      backLabel="Back to rooms"
      aside={<RoomPreview name={name.trim()} />}
    >
      <Form<DetailsValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={create.isPending}
        initialValues={{ ndaRequired: true, allowDownload: false, watermarkEnabled: true }}
        onFinish={(values) =>
          create.mutate({
            name: values.name.trim(),
            recipientCompanyId: company.companyId,
            recipientCompanyName: company.companyId ? undefined : company.companyName,
            ndaRequired: values.ndaRequired,
            allowDownload: values.allowDownload,
            watermarkEnabled: values.watermarkEnabled,
          })
        }
      >
        <Stack gap="xl">
          <ErrorAlert error={create.error} fallback="Could not create the room." />

          <Stack gap="lg">
            <Form.Item
              name="name"
              label="Room name"
              rules={[
                { required: true, message: 'Give the room a name.' },
                { min: 2, max: 120, message: 'Between 2 and 120 characters.' },
              ]}
              style={{ marginBottom: 0 }}
            >
              <Input size="large" autoFocus placeholder="Project Alpha" />
            </Form.Item>

            <Form.Item label="Who are you sharing it with?" style={{ marginBottom: 0 }}>
              <CompanyPicker
                value={company}
                onChange={setCompany}
                placeholder="Astrivax Therapeutics"
              />
            </Form.Item>
          </Stack>

          <Section title="Security" icon={<ShieldIcon />}>
            <SecurityToggle
              name="watermarkEnabled"
              label="Watermark every page"
              help="Each viewer gets their own copy, stamped with their name and email. Burned into the PDF, not drawn over it."
            />
            <SecurityToggle
              name="ndaRequired"
              label="Require an NDA before anyone sees a document"
              help="Click-through acceptance, recorded with a timestamp and the version of the text."
            />
            <SecurityToggle
              name="allowDownload"
              label="Allow downloads"
              help="Off means reviewers read in the browser. You can change this later in room settings."
            />
            <Note icon={<CheckCircleIcon />}>
              Audit logging is always on. Every view, comment and download is recorded.
            </Note>
          </Section>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space.sm }}>
            <Button
              intent="primary"
              size="large"
              htmlType="submit"
              loading={create.isPending}
              // Nothing to create until the room has a name, and a button that
              // only fails when pressed is worse than one that waits.
              disabled={name.trim().length < 2}
            >
              Create room and continue
            </Button>
          </div>
        </Stack>
      </Form>
    </OnboardLayout>
  );
}

/** A labelled group inside the form column, separated by a rule rather than a card. */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const { colors, space } = useVeyraTokens();
  return (
    <div style={{ borderTop: `1px solid ${colors.divider}`, paddingTop: space.xl }}>
      <Stack gap="lg">
        {/* The row is the flex container, not the Text: `strong` wraps all of
            its children in one element, which would put the glyph and the word
            in the same flex item and collapse the gap between them. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          {icon}
          <Typography.Text strong>{title}</Typography.Text>
        </div>
        {children}
      </Stack>
    </div>
  );
}

/**
 * A footnote with a glyph. The icon sits in its own column rather than inline,
 * so a second line starts under the first word instead of under the icon.
 */
function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const { colors, space } = useVeyraTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: space.sm,
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <span style={{ display: 'flex', flex: '0 0 auto', paddingTop: 2 }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SecurityToggle({ name, label, help }: { name: string; label: string; help: string }) {
  const { space } = useVeyraTokens();
  return (
    <div style={{ display: 'flex', gap: space.md, alignItems: 'flex-start' }}>
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch />
      </Form.Item>
      <div>
        <Typography.Text style={{ display: 'block' }}>{label}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {help}
        </Typography.Text>
      </div>
    </div>
  );
}

/*
 * The five CTD modules every room seeds from (D7). Titles are duplicated here
 * only to preview a room that doesn't exist yet — the room's own modules always
 * come from the server's `ctd` template once it does.
 */
const CTD_PREVIEW = [
  ['Module 1', 'Administrative Information'],
  ['Module 2', 'CTD Summaries'],
  ['Module 3', 'Quality'],
  ['Module 4', 'Nonclinical Study Reports'],
  ['Module 5', 'Clinical Study Reports'],
];

function RoomPreview({ name }: { name: string }) {
  const { space } = useVeyraTokens();
  return (
    <AsidePanel
      eyebrow="Your data room"
      title={name || 'Project Alpha'}
      dimTitle={name.length === 0}
      lede="Modules 1–5 are created for you, empty. Structure comes from what you upload — there is no skeleton to delete."
    >
      <Stack gap="xs">
        {CTD_PREVIEW.map(([code, title]) => (
          <div
            key={code}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: space.sm,
              padding: `${space.md}px ${space.lg}px`,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.1)',
              fontSize: 13,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <span>
              <strong style={{ marginRight: space.sm }}>{code}</strong>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>empty</span>
          </div>
        ))}
      </Stack>
      <AsideFootnote>
        Plus a <strong>Documents</strong> section for anything outside the dossier.
      </AsideFootnote>
    </AsidePanel>
  );
}

// ── The preview panel ───────────────────────────────────────────────────────

/**
 * Content for the right-hand panel. It sits on the brand's own ground, so its
 * inks are fixed whites rather than theme tokens — the ground doesn't invert
 * with the theme, and text that did would disappear.
 */
function AsidePanel({
  eyebrow,
  title,
  dimTitle = false,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  /** The title is standing in for something not yet typed. */
  dimTitle?: boolean;
  lede: ReactNode;
  children: ReactNode;
}) {
  const { space } = useVeyraTokens();
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {eyebrow}
        </span>
        <Typography.Title
          level={2}
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            fontWeight: 600,
            color: dimTitle ? 'rgba(255,255,255,0.45)' : '#ffffff',
          }}
        >
          {title}
        </Typography.Title>
        <p
          style={{
            margin: `${space.xs}px 0 0`,
            fontSize: 14,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          {lede}
        </p>
      </Stack>
      {children}
    </Stack>
  );
}

function AsideFootnote({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)' }}>
      {children}
    </p>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

interface InviteRow {
  key: number;
  email: string;
  role: ParticipantRole;
  company: CompanyChoice;
}

let nextRowKey = 1;
const emptyRow = (): InviteRow => ({ key: nextRowKey++, email: '', role: 'reviewer', company: {} });

function InviteStep({ room }: { room: RoomDetail }) {
  const { space } = useVeyraTokens();
  const [rows, setRows] = useState<InviteRow[]>([emptyRow()]);
  const [failures, setFailures] = useState<string[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const ready = rows.filter((row) => row.email.includes('@') && hasCompany(row.company));

  const send = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];
      for (const row of ready) {
        try {
          await invitationsApi.create(room.id, {
            email: row.email.trim(),
            role: row.role,
            companyId: row.company.companyId,
            companyName: row.company.companyId ? undefined : row.company.companyName,
          });
        } catch (error) {
          // One bad address shouldn't discard the others already sent.
          errors.push(`${row.email}: ${messageOf(error)}`);
        }
      }
      return errors;
    },
    onSuccess: async (errors) => {
      setFailures(errors);
      await queryClient.invalidateQueries({ queryKey: qk.invitations(room.id) });
      const sent = ready.length - errors.length;
      if (sent > 0) message.success(`${sent} invitation${sent === 1 ? '' : 's'} sent.`);
      if (errors.length === 0) {
        await navigate({ to: '/rooms/$roomId/overview', params: { roomId: room.id } });
      }
    },
  });

  const update = (key: number, patch: Partial<InviteRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <OnboardLayout
      step={2}
      stepCount={2}
      title="Invite people"
      subtitle={`${room.name} exists — this step is skippable.`}
      // No way back: the room was created by the step behind us, and an arrow
      // that returned to a form which would create a second one is a trap.
      aside={<InvitePreview room={room} />}
      // Four controls to a row, where step one is one field to a row.
      width={660}
    >
      <Stack gap="xl">
        {failures.length > 0 ? <ErrorAlert error={new Error(failures.join(' · '))} /> : null}

        <Stack gap="lg">
          <Typography.Text strong>Who else needs access?</Typography.Text>

          <Stack gap="md">
            {rows.map((row) => (
              <div key={row.key} className="veyra-invite-row">
                <Input
                  placeholder="name@company.com"
                  value={row.email}
                  inputMode="email"
                  onChange={(event) => update(row.key, { email: event.target.value })}
                />
                <CompanyPicker
                  size="middle"
                  value={row.company}
                  emailHint={row.email}
                  onChange={(company) => update(row.key, { company })}
                  placeholder="Company"
                />
                <Select<ParticipantRole>
                  value={row.role}
                  onChange={(role) => update(row.key, { role })}
                  options={(['admin', 'contributor', 'reviewer'] as const).map((role) => ({
                    value: role,
                    label: ROLE_SHORT[role],
                  }))}
                />
                <Button
                  intent="ghost"
                  icon={<DeleteIcon />}
                  aria-label={`Remove ${row.email || 'this row'}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                />
              </div>
            ))}
          </Stack>

          <div>
            <Button
              intent="link"
              icon={<PlusIcon />}
              onClick={() => setRows((current) => [...current, emptyRow()])}
            >
              Add another
            </Button>
          </div>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            The company comes from the email domain where we can match it, and which side someone is
            on follows from their company. Anyone we can’t place is asked about individually.
          </Typography.Text>
        </Stack>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space.sm }}>
          <Button
            intent="tertiary"
            size="large"
            disabled={send.isPending}
            onClick={() =>
              void navigate({ to: '/rooms/$roomId/overview', params: { roomId: room.id } })
            }
          >
            Invite later
          </Button>
          <Button
            intent="primary"
            size="large"
            loading={send.isPending}
            disabled={ready.length === 0}
            onClick={() => send.mutate()}
          >
            {ready.length > 0
              ? `Send ${ready.length} invitation${ready.length === 1 ? '' : 's'}`
              : 'Send invitations'}
          </Button>
        </div>
      </Stack>
    </OnboardLayout>
  );
}

function InvitePreview({ room }: { room: RoomDetail }) {
  const { space } = useVeyraTokens();
  return (
    <AsidePanel
      eyebrow="What they’ll get"
      title={room.name}
      lede={
        <>
          An email inviting them to the room. They set a password
          {room.ndaRequired ? ', accept the NDA' : ''} and land on an empty room until you upload —
          so it’s worth loading Module 3 first if the dossier isn’t ready.
        </>
      }
    >
      {/* The role select offers three words; what each one can do belongs
          beside the choice rather than behind a help icon. */}
      <Stack gap="xs">
        {(['admin', 'contributor', 'reviewer'] as const).map((role) => {
          const [, can] = ROLE_LABELS[role].split(' — ');
          return (
            <div
              key={role}
              style={{
                padding: `${space.md}px ${space.lg}px`,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                fontSize: 13,
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              <strong style={{ color: 'rgba(255,255,255,0.95)', marginRight: space.sm }}>
                {ROLE_SHORT[role]}
              </strong>
              {can}
            </div>
          );
        })}
      </Stack>
      <AsideFootnote>Invitations expire after 14 days, with a reminder at 72 hours.</AsideFootnote>
    </AsidePanel>
  );
}
