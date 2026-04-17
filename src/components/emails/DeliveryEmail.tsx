import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface DeliveryEmailProps {
  products: Array<{ id: string; name: string; price: number }>;
  downloadLinks: Array<{ productName: string; url: string }>;
  orderTotal: number; // in cents
}

export function DeliveryEmail({
  products,
  downloadLinks,
  orderTotal,
}: DeliveryEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your PixelDropp wallpapers are ready to download!</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ─────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logoText}>✦ PixelDropp</Text>
            <Text style={styles.tagline}>Beautiful wallpapers for every screen</Text>
          </Section>

          {/* ── Main card ──────────────────────────────────────── */}
          <Section style={styles.card}>
            <Text style={styles.heading}>Your wallpapers are ready! 🎨</Text>
            <Text style={styles.subheading}>
              Thank you for your purchase. Your high-resolution files are waiting below.
            </Text>

            {/* Order summary */}
            <Hr style={styles.divider} />
            <Text style={styles.sectionLabel}>Order Summary</Text>

            {products.map((product) => (
              <Section key={product.id} style={styles.lineItem}>
                <Text style={styles.lineItemName}>{product.name}</Text>
                <Text style={styles.lineItemPrice}>
                  ${(product.price / 100).toFixed(2)}
                </Text>
              </Section>
            ))}

            <Hr style={styles.divider} />

            <Section style={styles.lineItem}>
              <Text style={styles.totalLabel}>Total paid</Text>
              <Text style={styles.totalValue}>
                ${(orderTotal / 100).toFixed(2)}
              </Text>
            </Section>
          </Section>

          {/* ── Download buttons ───────────────────────────────── */}
          <Section style={styles.downloadsSection}>
            <Text style={styles.downloadsHeading}>Your Downloads</Text>

            {downloadLinks.map((item, i) => (
              <Section key={i} style={styles.downloadRow}>
                <Button href={item.url} style={styles.downloadButton}>
                  ↓ Download — {item.productName}
                </Button>
              </Section>
            ))}
          </Section>

          {/* ── Expiry note ────────────────────────────────────── */}
          <Section style={styles.noteBox}>
            <Text style={styles.noteText}>
              ⏱ Links expire in 48 hours. Reply to this email if you need them resent.
            </Text>
          </Section>

          {/* ── Footer ─────────────────────────────────────────── */}
          <Hr style={styles.divider} />
          <Text style={styles.footerPrimary}>
            Thank you for your purchase · PixelDropp
          </Text>
          <Text style={styles.footerSecondary}>
            You received this email because you made a purchase at pixeldrop.com
          </Text>

        </Container>
      </Body>
    </Html>
  );
}

// ── Inline styles (email-safe) ──────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: '#0A0A0A',
    fontFamily: 'system-ui, -apple-system, Helvetica Neue, Arial, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    textAlign: 'center',
    paddingBottom: '24px',
  },
  logoText: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#EDEDED',
    margin: '0',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: '13px',
    color: '#9CA3AF',
    margin: '6px 0 0',
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: '16px',
    padding: '28px',
    marginBottom: '20px',
    border: '1px solid #1F1F1F',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#EDEDED',
    margin: '0 0 10px',
    letterSpacing: '-0.02em',
  },
  subheading: {
    fontSize: '15px',
    color: '#9CA3AF',
    margin: '0 0 24px',
    lineHeight: '1.6',
  },
  divider: {
    borderColor: '#1F1F1F',
    margin: '20px 0',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 14px',
  },
  lineItem: {
    marginBottom: '10px',
  },
  lineItemName: {
    fontSize: '14px',
    color: '#EDEDED',
    margin: '0',
    display: 'inline',
  },
  lineItemPrice: {
    fontSize: '14px',
    color: '#9CA3AF',
    margin: '2px 0 0',
  },
  totalLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#EDEDED',
    margin: '0',
  },
  totalValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#EDEDED',
    margin: '2px 0 0',
  },
  downloadsSection: {
    marginBottom: '20px',
  },
  downloadsHeading: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#EDEDED',
    margin: '0 0 16px',
  },
  downloadRow: {
    marginBottom: '10px',
  },
  downloadButton: {
    backgroundColor: '#5B21B6',
    color: '#ffffff',
    padding: '14px 24px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  noteBox: {
    backgroundColor: '#111111',
    borderRadius: '10px',
    padding: '14px 18px',
    marginBottom: '24px',
    border: '1px solid #1F1F1F',
  },
  noteText: {
    fontSize: '13px',
    color: '#9CA3AF',
    margin: '0',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  footerPrimary: {
    fontSize: '12px',
    color: '#6B7280',
    textAlign: 'center',
    margin: '16px 0 6px',
  },
  footerSecondary: {
    fontSize: '11px',
    color: '#374151',
    textAlign: 'center',
    margin: '0',
  },
};
