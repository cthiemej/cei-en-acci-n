import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './PDFStyles';
import { PDFHeader, PDFFooter } from './PDFHeader';

interface Props {
  code: string;
  title: string;
  investigator: string;
  faculty: string;
  sessionNumber: number;
  sessionDate: string;
  voteResult?: { a_favor: number; en_contra: number; abstenciones: number };
  resolutionSummary: string;
  generatedDate: string;
}

export const ActaAprobacion = ({ code, title, investigator, faculty, sessionNumber, sessionDate, voteResult, resolutionSummary, generatedDate }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PDFHeader />
      <Text style={styles.title}>Acta de Aprobación Ética</Text>
      <View style={styles.line} />
      <View style={{ marginTop: 20 }}>
        <View style={styles.row}><Text style={styles.rowLabel}>Código del proyecto:</Text><Text style={styles.rowValue}>{code}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Título:</Text><Text style={styles.rowValue}>{title}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Investigador principal:</Text><Text style={styles.rowValue}>{investigator}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Facultad:</Text><Text style={styles.rowValue}>{faculty || 'No especificada'}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Sesión N°:</Text><Text style={styles.rowValue}>{sessionNumber}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Fecha de sesión:</Text><Text style={styles.rowValue}>{sessionDate}</Text></View>
        {voteResult && (
          <View style={styles.row}><Text style={styles.rowLabel}>Votación:</Text><Text style={styles.rowValue}>{voteResult.a_favor} a favor, {voteResult.en_contra} en contra, {voteResult.abstenciones} abstenciones</Text></View>
        )}
      </View>
      <View style={{ marginTop: 30 }}>
        <Text style={styles.body}>
          El Comité de Ética en Investigación de la Universidad Diego Portales, en su Sesión {sessionNumber} de fecha {sessionDate}, ha resuelto APROBAR éticamente el proyecto de investigación {code} titulado "{title}", presentado por {investigator}.
        </Text>
        {resolutionSummary && <Text style={styles.body}>Resolución: {resolutionSummary}</Text>}
        <Text style={styles.body}>
          La presente aprobación es válida por el período que dure la investigación según lo declarado en el protocolo presentado. Cualquier modificación sustancial al protocolo deberá ser sometida a nueva evaluación por el Comité.
        </Text>
      </View>
      <PDFFooter generatedDate={generatedDate} />
    </Page>
  </Document>
);
