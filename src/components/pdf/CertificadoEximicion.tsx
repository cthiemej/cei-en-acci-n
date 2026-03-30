import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './PDFStyles';
import { PDFHeader, PDFFooter } from './PDFHeader';

interface Props {
  code: string;
  title: string;
  investigator: string;
  faculty: string;
  usesSecondaryDataOnly: boolean;
  involvesHumanParticipants: boolean;
  generatedDate: string;
}

export const CertificadoEximicion = ({ code, title, investigator, faculty, usesSecondaryDataOnly, involvesHumanParticipants, generatedDate }: Props) => {
  const reasons: string[] = [];
  if (usesSecondaryDataOnly) reasons.push('utiliza únicamente bases de datos secundarias de acceso público');
  if (!involvesHumanParticipants) reasons.push('no involucra participantes humanos directamente');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PDFHeader />
        <Text style={styles.title}>Certificado de Eximición de Evaluación Ética</Text>
        <View style={styles.line} />
        <View style={{ marginTop: 20 }}>
          <View style={styles.row}><Text style={styles.rowLabel}>Código del proyecto:</Text><Text style={styles.rowValue}>{code}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Título:</Text><Text style={styles.rowValue}>{title}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Investigador principal:</Text><Text style={styles.rowValue}>{investigator}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Facultad:</Text><Text style={styles.rowValue}>{faculty || 'No especificada'}</Text></View>
        </View>
        <View style={{ marginTop: 30 }}>
          <Text style={styles.body}>
            El Comité de Ética en Investigación de la Universidad Diego Portales certifica que el proyecto {code} titulado "{title}", presentado por {investigator}, ha sido EXIMIDO de evaluación ética completa.
          </Text>
          <Text style={styles.body}>
            Justificación: el proyecto {reasons.join(' y ')}.
          </Text>
          <Text style={styles.body}>
            De acuerdo con el Reglamento del CEI-UDP, los proyectos que cumplen estas condiciones no requieren evaluación ética por el Comité.
          </Text>
        </View>
        <PDFFooter generatedDate={generatedDate} />
      </Page>
    </Document>
  );
};
