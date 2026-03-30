import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './PDFStyles';
import { PDFHeader, PDFFooter } from './PDFHeader';

interface Props {
  code: string;
  title: string;
  investigator: string;
  faculty: string;
  receptionDate: string;
  generatedDate: string;
}

export const CertificadoRecepcion = ({ code, title, investigator, faculty, receptionDate, generatedDate }: Props) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PDFHeader />
      <Text style={styles.title}>Certificado de Recepción de Solicitud</Text>
      <View style={styles.line} />
      <View style={{ marginTop: 20 }}>
        <View style={styles.row}><Text style={styles.rowLabel}>Código del proyecto:</Text><Text style={styles.rowValue}>{code}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Título:</Text><Text style={styles.rowValue}>{title}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Investigador principal:</Text><Text style={styles.rowValue}>{investigator}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Facultad:</Text><Text style={styles.rowValue}>{faculty || 'No especificada'}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Fecha de recepción:</Text><Text style={styles.rowValue}>{receptionDate}</Text></View>
      </View>
      <View style={{ marginTop: 30 }}>
        <Text style={styles.body}>
          Se certifica que con fecha {receptionDate} se ha recibido la solicitud de evaluación ética del proyecto {code} titulado "{title}", presentado por {investigator} de la Facultad de {faculty || '[no especificada]'}. El Comité procederá a su revisión en conformidad con el Reglamento del CEI-UDP.
        </Text>
      </View>
      <PDFFooter generatedDate={generatedDate} />
    </Page>
  </Document>
);
