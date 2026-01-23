// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

const getThinkerFormatLocation = (oldFile: string): LocationResult | null => {
  // CC 2.1.15+ format: Look for the pattern directly
  // Pattern: JA=(X??x?.activeForm??c)+"…"
  const newFormatPattern =
    /([$\w]+)=\(([^)]+\?\?[$\w]+\?\.activeForm\?\?[$\w]+)\)\+"(?:…|\\u2026)"/;
  const newFormatMatch = oldFile.match(newFormatPattern);

  if (newFormatMatch && newFormatMatch.index !== undefined) {
    return {
      startIndex: newFormatMatch.index + newFormatMatch[1].length,
      endIndex: newFormatMatch.index + newFormatMatch[0].length,
      identifiers: [newFormatMatch[2]], // The expression inside parens (X??x?.activeForm??c)
    };
  }

  // Old format: spinnerTip:X,Y:Z,overrideMessage:W,.{300}
  const approxAreaPatternOld =
    /spinnerTip:[$\w]+,(?:[$\w]+:[$\w]+,)*overrideMessage:[$\w]+,.{300}/;
  const approxAreaMatchOld = oldFile.match(approxAreaPatternOld);

  if (approxAreaMatchOld && approxAreaMatchOld.index !== undefined) {
    // Search within a range of 1000 characters to support older CC versions
    const searchSection = oldFile.slice(
      approxAreaMatchOld.index,
      approxAreaMatchOld.index + 1000
    );

    // New nullish format: N=(Y??C?.activeForm??L)+"…"
    const formatPattern = /([$\w]+)(=\(([^;]{1,200}?)\)\+"(?:…|\\u2026)")/;
    const formatMatch = searchSection.match(formatPattern);

    if (formatMatch && formatMatch.index !== undefined) {
      return {
        startIndex:
          approxAreaMatchOld.index + formatMatch.index + formatMatch[1].length,
        endIndex:
          approxAreaMatchOld.index +
          formatMatch.index +
          formatMatch[1].length +
          formatMatch[2].length,
        identifiers: [formatMatch[3]],
      };
    }
  }

  console.error('patch: thinker format: failed to find formatMatch');
  return null;
};

export const writeThinkerFormat = (
  oldFile: string,
  format: string
): string | null => {
  const location = getThinkerFormatLocation(oldFile);
  if (!location) {
    return null;
  }
  const fmtLocation = location;

  // See `getThinkerFormatLocation` for an explanation of this.
  const serializedFormat = format.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const curExpr = fmtLocation.identifiers?.[0];
  const curFmt =
    '`' + serializedFormat.replace(/\{\}/g, '${' + curExpr + '}') + '`';
  const formatDecl = `=${curFmt}`;

  const newFile =
    oldFile.slice(0, fmtLocation.startIndex) +
    formatDecl +
    oldFile.slice(fmtLocation.endIndex);

  showDiff(
    oldFile,
    newFile,
    formatDecl,
    fmtLocation.startIndex,
    fmtLocation.endIndex
  );
  return newFile;
};
