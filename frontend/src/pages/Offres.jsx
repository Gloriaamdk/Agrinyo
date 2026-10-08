import { useSession } from '../session.jsx'
import MesOffres from './MesOffres.jsx'
import OffresOuvertes from './OffresOuvertes.jsx'

/** /offres : l'agriculteur voit ses offres, le propriétaire celles des agriculteurs. */
export default function Offres() {
  const { estDetenteur } = useSession()
  return estDetenteur ? <OffresOuvertes /> : <MesOffres />
}
