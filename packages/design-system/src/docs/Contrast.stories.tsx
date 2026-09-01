import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table, Tag, Typography } from 'antd';

import { fontFamily, fontSize, space } from '../tokens';
import { useAntdToken, useThemeMode, useVeyraTokens } from '../theme';
import { contrastRatio, grade, type ContrastLevel } from './contrast';
import { Section } from './Swatch';

const meta: Meta = {
  title: 'Foundations/Contrast',
  parameters: {
    a11y: {
      // The "Aa" chips are specimens of each pairing, including ones that are
      // meant to sit below 4.5:1 (borders and fills are held to 3:1). axe reads
      // them as body text and flags every sub-threshold sample, so the rule is
      // off here — the table's own Result column is the real audit.
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
    docs: {
      description: {
        component:
          'Every pairing the system relies on, measured. Text pairs are graded against ' +
          'WCAG AA for normal-size text (4.5:1); non-text pairs such as fills and borders ' +
          'are held to 3:1.\n\n' +
          'Two results here drove real token decisions. `danger` was darkened until white ' +
          'label text cleared AA on a solid button. And every status role moved to a darker ' +
          'ramp step, because antd spends one token on two jobs — Tag and Alert paint it as ' +
          'text on its own tint, so a vivid amber that reads well as a fill failed at 2.03:1 ' +
          'as text.',
      },
    },
  },
};
export default meta;

const LEVEL_COLOR: Record<ContrastLevel, string> = {
  AAA: 'success',
  AA: 'success',
  'AA Large': 'warning',
  Fail: 'error',
};

interface Row {
  key: string;
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  level: ContrastLevel;
  required: number;
}

function buildRows(
  entries: [label: string, fg: string, bg: string][],
  required: number,
): Row[] {
  return entries.map(([pair, foreground, background]) => {
    const ratio = contrastRatio(foreground, background);
    return {
      key: pair,
      pair,
      foreground,
      background,
      ratio,
      level: grade(ratio),
      required,
    };
  });
}

function ContrastTable({ rows }: { rows: Row[] }) {
  return (
    <Table<Row>
      dataSource={rows}
      pagination={false}
      size="small"
      columns={[
        {
          title: 'Pairing',
          dataIndex: 'pair',
          key: 'pair',
          render: (pair: string, row) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: space.md }}>
              <span
                style={{
                  background: row.background,
                  color: row.foreground,
                  padding: `2px ${space.sm}px`,
                  borderRadius: 4,
                  fontSize: fontSize.sm,
                  whiteSpace: 'nowrap',
                }}
              >
                Aa
              </span>
              {pair}
            </span>
          ),
        },
        {
          title: 'Ratio',
          dataIndex: 'ratio',
          key: 'ratio',
          align: 'right',
          render: (ratio: number) => (
            <code style={{ fontFamily: fontFamily.mono }}>{ratio.toFixed(2)}:1</code>
          ),
        },
        {
          title: 'Needs',
          dataIndex: 'required',
          key: 'required',
          align: 'right',
          render: (required: number) => (
            <code style={{ fontFamily: fontFamily.mono }}>{required}:1</code>
          ),
        },
        {
          title: 'Result',
          dataIndex: 'level',
          key: 'level',
          render: (level: ContrastLevel, row) => {
            const passed = row.ratio >= row.required;
            // AAA/AA are text grades; a non-text pair either clears 3:1 or not.
            const label = passed ? (row.required === 3 ? 'Pass' : level) : 'Fail';
            return <Tag color={passed ? LEVEL_COLOR[level] : 'error'}>{label}</Tag>;
          },
        },
      ]}
    />
  );
}

/** Switch the toolbar theme to audit the other mode. */
export const Audit: StoryObj = {
  render: function AuditStory() {
    const { mode } = useThemeMode();
    const { colors } = useVeyraTokens();

    /*
     * Measured against antd's *resolved* tokens, not our raw semantic values.
     * The two differ: antd runs the seeds through its light/dark algorithm, so
     * `colorPrimary` on screen is not the `brand` value we handed it. Auditing
     * the input rather than the output would report numbers nobody ever sees.
     */
    const token = useAntdToken();

    // Mirrors the Button `primaryColor`/`dangerColor` set in createTheme.
    const solidLabel = mode === 'dark' ? colors.textInverse : '#ffffff';

    const textRows = buildRows(
      [
        ['colorText on container', token.colorText, token.colorBgContainer],
        ['colorTextSecondary on container', token.colorTextSecondary, token.colorBgContainer],
        ['colorTextTertiary on container', token.colorTextTertiary, token.colorBgContainer],
        ['colorText on layout', token.colorText, token.colorBgLayout],
        ['colorTextSecondary on layout', token.colorTextSecondary, token.colorBgLayout],
        ['colorTextTertiary on layout', token.colorTextTertiary, token.colorBgLayout],
        ['colorLink on layout', token.colorLink, token.colorBgLayout],
      ],
      4.5,
    );

    const solidRows = buildRows(
      [
        ['button label on colorPrimary', solidLabel, token.colorPrimary],
        ['button label on colorError', solidLabel, token.colorError],
      ],
      4.5,
    );

    const statusRows = buildRows(
      [
        ['colorSuccess on colorSuccessBg', token.colorSuccess, token.colorSuccessBg],
        ['colorWarning on colorWarningBg', token.colorWarning, token.colorWarningBg],
        ['colorError on colorErrorBg', token.colorError, token.colorErrorBg],
        ['colorInfo on colorInfoBg', token.colorInfo, token.colorInfoBg],
      ],
      4.5,
    );

    const nonTextRows = buildRows(
      [
        ['colorBorder on container', token.colorBorder, token.colorBgContainer],
        ['colorPrimary fill on layout', token.colorPrimary, token.colorBgLayout],
        ['colorSuccess fill on layout', token.colorSuccess, token.colorBgLayout],
        ['colorWarning fill on layout', token.colorWarning, token.colorBgLayout],
        ['colorError fill on layout', token.colorError, token.colorBgLayout],
      ],
      3,
    );

    return (
      <>
        <Typography.Paragraph type="secondary" style={{ marginBottom: space.xl }}>
          Measured live in <Typography.Text strong>{mode}</Typography.Text> mode.
        </Typography.Paragraph>

        <Section title="Body text" description="Normal-size text — WCAG AA needs 4.5:1.">
          <ContrastTable rows={textRows} />
        </Section>

        <Section title="Text on solid fills" description="Button labels on a coloured background.">
          <ContrastTable rows={solidRows} />
        </Section>

        <Section
          title="Status text on tinted backgrounds"
          description="How Tag and Alert paint each status: the status colour as text on its own tint."
        >
          <ContrastTable rows={statusRows} />
        </Section>

        <Section
          title="Non-text"
          description="Borders and fills carrying meaning — WCAG AA needs 3:1."
        >
          <ContrastTable rows={nonTextRows} />
        </Section>
      </>
    );
  },
};
