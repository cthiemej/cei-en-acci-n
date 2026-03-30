import { View, Text } from '@react-pdf/renderer';
import { styles } from './PDFStyles';

export const PDFHeader = () => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Universidad Diego Portales</Text>
    <Text style={styles.headerSubtitle}>Comité de Ética en Investigación</Text>
  </View>
);

export const PDFFooter = ({ generatedDate }: { generatedDate: string }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Este documento ha sido generado automáticamente por la Plataforma CEI-UDP.</Text>
    <Text style={styles.footerText}>Generado: {generatedDate}</Text>
  </View>
);
