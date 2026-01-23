// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

/**
 * Forces thinking blocks to be visible inline by default, ensuring thinking content
 * always renders as if in transcript mode.
 */

const getThinkingVisibilityLocation = (
  oldFile: string
): LocationResult | null => {
  // CC 2.1.15+ format: Uses React compiler memoization with K[] cache
  // case"thinking":{if(!D&&!H)return null;let T=D&&!(!V||P===V),k;if(K[22]!==Y||...)k=g3.createElement(k_1,{addMargin:Y,param:q,isTranscriptMode:D,verbose:H,hideInTranscript:T}),K[...]=k;else k=K[...];return k}
  const memoizedPattern =
    /(case"thinking":\{)if\(!([$\w]+)&&!([$\w]+)\)return null;let ([$\w]+)=\2&&!\(!([$\w]+)\|\|([$\w]+)===\5\),([$\w]+);if\([$\w]+\[\d+\]!==[$\w]+\|\|[$\w]+\[\d+\]!==\2\|\|[$\w]+\[\d+\]!==[$\w]+\|\|[$\w]+\[\d+\]!==\4\|\|[$\w]+\[\d+\]!==\3\)\7=([$\w]+)\.createElement\(([$\w]+),\{addMargin:([$\w]+),param:([$\w]+),isTranscriptMode:\2,verbose:\3,hideInTranscript:\4\}\)/;
  const memoizedMatch = oldFile.match(memoizedPattern);

  if (memoizedMatch && memoizedMatch.index !== undefined) {
    const startIndex = memoizedMatch.index;
    const endIndex = startIndex + memoizedMatch[0].length;

    return {
      startIndex,
      endIndex,
      identifiers: [
        memoizedMatch[1], // case"thinking":{
        memoizedMatch[2], // isTranscriptMode var (D)
        memoizedMatch[3], // verbose var (H)
        memoizedMatch[4], // hideInTranscript var (T)
        memoizedMatch[7], // result var (k)
        memoizedMatch[8], // React var (g3)
        memoizedMatch[9], // component (k_1)
        memoizedMatch[10], // addMargin var (Y)
        memoizedMatch[11], // param var (q)
        'memoized_format',
      ],
    };
  }

  // New format (2.0.77+): Case body wrapped in braces with additional hideInTranscript param
  // npm: case"thinking":{if(!D&&!Z)return null;return n8.createElement($bA,{addMargin:Q,param:A,isTranscriptMode:D,verbose:Z,hideInTranscript:D&&!(!$||z===$)})}
  const newVisibilityPattern =
    /(case"thinking":)\{if\(![$\w]+&&![$\w]+\)return null;(return [$\w]+\.createElement\([$\w]+,\{addMargin:[$\w]+,param:[$\w]+,isTranscriptMode:)([$\w]+)(,verbose:[$\w]+,hideInTranscript:[$\w]+&&!\(![$\w]+\|\|[$\w]+===[$\w]+\)\})\)\}/;
  const newVisibilityMatch = oldFile.match(newVisibilityPattern);

  if (newVisibilityMatch && newVisibilityMatch.index !== undefined) {
    const startIndex = newVisibilityMatch.index;
    const endIndex = startIndex + newVisibilityMatch[0].length;

    return {
      startIndex,
      endIndex,
      identifiers: [
        newVisibilityMatch[1], // case"thinking":
        newVisibilityMatch[2], // return X.createElement(...,isTranscriptMode:
        newVisibilityMatch[4], // ,verbose:...,hideInTranscript:...})}
        'new_format',
      ],
    };
  }

  // Old format: Case without braces
  const oldVisibilityPattern =
    /(case"thinking":)if\([$\w!&]+\)return null;([$\w.]+\.createElement\([$\w]+,\{addMargin:[$\w]+,param:[$\w]+,isTranscriptMode:)([$\w]+)(,verbose:[$\w]+\s*\})\)/;
  const oldVisibilityMatch = oldFile.match(oldVisibilityPattern);

  if (oldVisibilityMatch && oldVisibilityMatch.index !== undefined) {
    const startIndex = oldVisibilityMatch.index;
    const endIndex = startIndex + oldVisibilityMatch[0].length;

    return {
      startIndex,
      endIndex,
      identifiers: [
        oldVisibilityMatch[1],
        oldVisibilityMatch[2],
        oldVisibilityMatch[4],
      ],
    };
  }

  console.error(
    'patch: thinkingVisibility: failed to find thinking visibility pattern'
  );
  return null;
};

export const writeThinkingVisibility = (oldFile: string): string | null => {
  // Force thinking visibility in renderer
  const visibilityLocation = getThinkingVisibilityLocation(oldFile);
  if (!visibilityLocation) {
    return null;
  }

  const formatType =
    visibilityLocation.identifiers![visibilityLocation.identifiers!.length - 1];

  let visibilityReplacement: string;

  if (formatType === 'memoized_format') {
    // CC 2.1.15+ memoized format: Remove the if-return-null check and set isTranscriptMode to true
    // identifiers: [caseStart, transcriptVar, verboseVar, hideVar, resultVar, reactVar, component, addMarginVar, paramVar]
    const caseStart = visibilityLocation.identifiers![0];
    // identifiers[1] is transcriptVar (D) - unused, we replace with true
    const verboseVar = visibilityLocation.identifiers![2];
    const hideVar = visibilityLocation.identifiers![3];
    const resultVar = visibilityLocation.identifiers![4];
    const reactVar = visibilityLocation.identifiers![5];
    const component = visibilityLocation.identifiers![6];
    const addMarginVar = visibilityLocation.identifiers![7];
    const paramVar = visibilityLocation.identifiers![8];

    // Build the replacement without the if-return-null, with isTranscriptMode:true
    visibilityReplacement = `${caseStart}let ${hideVar}=true&&!(!false||false===false),${resultVar};if(true)${resultVar}=${reactVar}.createElement(${component},{addMargin:${addMarginVar},param:${paramVar},isTranscriptMode:true,verbose:${verboseVar},hideInTranscript:${hideVar}})`;
  } else if (formatType === 'new_format') {
    // New format: case"thinking":{return X.createElement(...,isTranscriptMode:true,verbose:...,hideInTranscript:...})}
    visibilityReplacement = `${visibilityLocation.identifiers![0]}{${visibilityLocation.identifiers![1]}true${visibilityLocation.identifiers![2]})}`;
  } else {
    // Old format: case"thinking":return X.createElement(...,isTranscriptMode:true,verbose:...})
    visibilityReplacement = `${visibilityLocation.identifiers![0]}${visibilityLocation.identifiers![1]}true${visibilityLocation.identifiers![2]}`;
  }

  const newFile =
    oldFile.slice(0, visibilityLocation.startIndex) +
    visibilityReplacement +
    oldFile.slice(visibilityLocation.endIndex);

  showDiff(
    oldFile,
    newFile,
    visibilityReplacement,
    visibilityLocation.startIndex,
    visibilityLocation.endIndex
  );

  return newFile;
};
