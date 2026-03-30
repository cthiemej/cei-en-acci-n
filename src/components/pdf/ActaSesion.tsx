import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './PDFStyles';
import { PDFHeader, PDFFooter } from './PDFHeader';

interface Attendee { name: string; role: string; attended: boolean; signed: boolean; }
interface AgendaItem { order: number; description: string; projectCode?: string; projectTitle?: string; resolution?: string; voteResult?: { a_favor: number; en_contra: number; abstenciones: number }; }

interface Props {
  sessionNumber: number;
  sessionType: string;
  scheduledDate: string;
  quorumMet: boolean;
  attendees: Attendee[];
  agendaItems: AgendaItem[];
  minutesSummary: string;
  generatedDate: string;
}

export const ActaSesion = ({ sessionNumber, sessionType, scheduledDate, quorumMet, attendees, agendaItems, minutesSummary, generatedDate }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PDFHeader />
      <Text style={styles.title}>Acta de Sesión {sessionType === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'} N° {sessionNumber}</Text>
      <View style={styles.line} />

      <View style={{ marginTop: 10 }}>
        <View style={styles.row}><Text style={styles.rowLabel}>Fecha:</Text><Text style={styles.rowValue}>{scheduledDate}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Tipo:</Text><Text style={styles.rowValue}>{sessionType === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Quórum:</Text><Text style={styles.rowValue}>{quorumMet ? 'Cumplido' : 'No cumplido'} ({attendees.filter(a => a.attended).length}/{attendees.length})</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Asistencia</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellBold, { flex: 2 }]}>Nombre</Text>
          <Text style={styles.tableCellBold}>Rol</Text>
          <Text style={styles.tableCellBold}>Asistió</Text>
          <Text style={styles.tableCellBold}>Firmó</Text>
        </View>
        {attendees.map((a, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{a.name}</Text>
            <Text style={styles.tableCell}>{a.role}</Text>
            <Text style={styles.tableCell}>{a.attended ? 'Sí' : 'No'}</Text>
            <Text style={styles.tableCell}>{a.signed ? 'Sí' : 'No'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Puntos Tratados</Text>
        {agendaItems.map((item, i) => (
          <View key={i} style={{ marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#C8102E' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{item.order}. {item.description}</Text>
            {item.projectCode && <Text style={{ fontSize: 9, color: '#666', marginTop: 2 }}>Proyecto: {item.projectCode} — {item.projectTitle}</Text>}
            {item.resolution && <Text style={{ fontSize: 9, marginTop: 3 }}>Resolución: {item.resolution}</Text>}
            {item.voteResult && <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Votación: {item.voteResult.a_favor} a favor, {item.voteResult.en_contra} en contra, {item.voteResult.abstenciones} abstenciones</Text>}
          </View>
        ))}
      </View>

      {minutesSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observaciones Generales</Text>
          <Text style={styles.body}>{minutesSummary}</Text>
        </View>
      )}

      <PDFFooter generatedDate={generatedDate} />
    </Page>
  </Document>
);
