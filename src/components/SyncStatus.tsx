/**
 * Sync-status pill shown in the header.
 *
 * Reflects the live `dbStatus` from the store:
 *   - pending             : yellow dot, "Connexion..."
 *   - connected           : green dot, "Synchronisé"
 *   - saving              : blue dot, "Enregistrement..."
 *   - offline (no error)  : grey dot, "Hors ligne (local)"
 *   - offline (with error): red dot, "Erreur" + message in title
 *
 * Boss's mandate: the user must trust that their work is saved.
 */

import { useStore } from '../hooks/useStore';

export default function SyncStatus() {
  const { dbStatus, dbLastError } = useStore();

  // The store sets `'saving'` directly via `onSaveStart` in the debounced
  // saver, and flips back to `'connected'` or `'offline'` on the result.
  // Offline + error → red; offline alone is rare (initial config absent).
  const display = (() => {
    if (dbStatus === 'pending') {
      return { dot: 'yellow', text: 'Connexion...', title: 'Connexion à la base de données.' };
    }
    if (dbStatus === 'saving') {
      return { dot: 'blue', text: 'Enregistrement...', title: 'Synchronisation en cours.' };
    }
    if (dbStatus === 'offline') {
      if (dbLastError) {
        return { dot: 'red', text: 'Erreur', title: dbLastError.message };
      }
      return {
        dot: 'grey',
        text: 'Hors ligne (local)',
        title: 'Aucune connexion à la base — vos modifications sont sauvegardées en local et seront synchronisées au prochain démarrage.',
      };
    }
    // dbStatus === 'connected'
    return { dot: 'green', text: 'Synchronisé', title: 'Toutes les modifications sont enregistrées.' };
  })();

  return (
    <div className="sync-status" title={display.title} aria-live="polite">
      <span className={`sync-status__dot sync-status__dot--${display.dot}`} aria-hidden />
      <span className="sync-status__text">{display.text}</span>
    </div>
  );
}
