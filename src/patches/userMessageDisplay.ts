// Please see the note about writing patches in ./index
import {
  findBoxComponent,
  findChalkVar,
  LocationResult,
  showDiff,
} from './index';

const getUserMessageDisplayLocation = (
  oldFile: string
): LocationResult | null => {
  // CC 2.1.15+ format: memoized with K[] cache
  // Pattern: O=NKA.createElement(N,{backgroundColor:"userMessageBackground"},X,NKA.createElement(N,{color:"text"},J)),K[...]=J,K[...]=O;else O=K[...];return O
  const memoizedPattern =
    /([$\w]+)=([$\w]+)\.createElement\(([$\w]+),\{backgroundColor:"userMessageBackground"\},([$\w]+),\2\.createElement\(\3,\{color:"text"\},([$\w]+)\)\),[$\w]+\[\d+\]=\5,[$\w]+\[\d+\]=\1;else \1=[$\w]+\[\d+\];return \1/;
  const memoizedMatch = oldFile.match(memoizedPattern);
  if (memoizedMatch && memoizedMatch.index !== undefined) {
    return {
      startIndex: memoizedMatch.index,
      endIndex: memoizedMatch.index + memoizedMatch[0].length,
      identifiers: [
        memoizedMatch[2], // React var (NKA)
        memoizedMatch[3], // Text component (N)
        memoizedMatch[5], // Message var (J)
        memoizedMatch[1], // Output var (O)
        'memoized_format',
      ],
    };
  }

  // New format (2.0.77+): nested structure with pointer icon and separate color components
  // npm: return _W.createElement(C,{backgroundColor:"userMessageBackground"},...rJ.createElement(C,{color:"text"},V))
  const newMessageDisplayPattern =
    /return ([$\w]+)\.createElement\(([$\w]+),\{backgroundColor:"userMessageBackground"\},([$\w]+)\.createElement\([$\w]+,\{color:"subtle"\},([$\w]+)\.pointer," "\),[$\w]+\.createElement\([$\w]+,\{color:"text"\},([$\w]+)\)\)/;
  const newMessageDisplayMatch = oldFile.match(newMessageDisplayPattern);
  if (newMessageDisplayMatch && newMessageDisplayMatch.index !== undefined) {
    return {
      startIndex: newMessageDisplayMatch.index,
      endIndex: newMessageDisplayMatch.index + newMessageDisplayMatch[0].length,
      identifiers: [
        newMessageDisplayMatch[1], // React var (_W or rJ)
        newMessageDisplayMatch[2], // Text component (C or V)
        newMessageDisplayMatch[5], // Message var (V or U)
        'new_format',
      ],
    };
  }

  // Old format: single component with both backgroundColor and color
  // return X.createElement(Y,{backgroundColor:"userMessageBackground",color:"text"},"> ",Z+" ");
  const oldMessageDisplayPattern =
    /return ([$\w]+)\.createElement\(([$\w]+),\{backgroundColor:"userMessageBackground",color:"text"\},"> ",([$\w]+)\+" "\);/;
  const oldMessageDisplayMatch = oldFile.match(oldMessageDisplayPattern);
  if (oldMessageDisplayMatch && oldMessageDisplayMatch.index !== undefined) {
    return {
      startIndex: oldMessageDisplayMatch.index,
      endIndex: oldMessageDisplayMatch.index + oldMessageDisplayMatch[0].length,
      identifiers: [
        oldMessageDisplayMatch[1],
        oldMessageDisplayMatch[2],
        oldMessageDisplayMatch[3],
        'old_format',
      ],
    };
  }

  console.error(
    'patch: messageDisplayMatch: failed to find user message display pattern'
  );
  return null;
};

export const writeUserMessageDisplay = (
  oldFile: string,
  format: string,
  foregroundColor: string | 'default',
  backgroundColor: string | 'default' | null,
  bold: boolean = false,
  italic: boolean = false,
  underline: boolean = false,
  strikethrough: boolean = false,
  inverse: boolean = false,
  borderStyle: string = 'none',
  borderColor: string = 'rgb(255,255,255)',
  paddingX: number = 0,
  paddingY: number = 0,
  fitBoxToContent: boolean = false
): string | null => {
  const location = getUserMessageDisplayLocation(oldFile);
  if (!location) {
    console.error(
      '^ patch: userMessageDisplay: getUserMessageDisplayLocation returned null'
    );
    return null;
  }

  const chalkVar = findChalkVar(oldFile);
  if (!chalkVar) {
    console.error('^ patch: userMessageDisplay: failed to find chalk variable');
    return null;
  }

  const boxComponent = findBoxComponent(oldFile);
  if (!boxComponent) {
    console.error('^ patch: userMessageDisplay: failed to find box component');
    return null;
  }

  let chalkChain: string = '';

  // Build Ink attributes for default theme colors (do this ALWAYS, not conditionally)
  const textAttrs: string[] = [];
  if (foregroundColor === 'default') {
    textAttrs.push('color:"text"');
  }
  if (backgroundColor === 'default') {
    textAttrs.push('backgroundColor:"userMessageBackground"');
  }
  const textAttrsObjStr =
    textAttrs.length > 0 ? `{${textAttrs.join(',')}}` : '{}';

  // Build box attributes (border and padding)
  const boxAttrs: string[] = [];
  const isCustomBorder = borderStyle.startsWith('topBottom');

  if (borderStyle !== 'none') {
    if (isCustomBorder) {
      // Custom topBottom borders - only show top and bottom
      let customBorder = '';

      if (borderStyle === 'topBottomSingle') {
        customBorder =
          '{top:"─",bottom:"─",left:" ",right:" ",topLeft:" ",topRight:" ",bottomLeft:" ",bottomRight:" "}';
      } else if (borderStyle === 'topBottomDouble') {
        customBorder =
          '{top:"═",bottom:"═",left:" ",right:" ",topLeft:" ",topRight:" ",bottomLeft:" ",bottomRight:" "}';
      } else if (borderStyle === 'topBottomBold') {
        customBorder =
          '{top:"━",bottom:"━",left:" ",right:" ",topLeft:" ",topRight:" ",bottomLeft:" ",bottomRight:" "}';
      }

      boxAttrs.push(`borderStyle:${customBorder}`);
    } else {
      // Standard Ink border styles
      boxAttrs.push(`borderStyle:"${borderStyle}"`);
    }

    const borderMatch = borderColor.match(/\d+/g);
    if (borderMatch) {
      boxAttrs.push(`borderColor:"rgb(${borderMatch.join(',')})"`);
    }
  }
  if (paddingX > 0) {
    boxAttrs.push(`paddingX:${paddingX}`);
  }
  if (paddingY > 0) {
    boxAttrs.push(`paddingY:${paddingY}`);
  }
  if (fitBoxToContent) {
    boxAttrs.push(`alignSelf:"flex-start"`);
  }
  const boxAttrsObjStr = boxAttrs.length > 0 ? `{${boxAttrs.join(',')}}` : '{}';

  // Determine if we need chalk styling (custom RGB colors or text styling)
  const needsChalk =
    foregroundColor !== 'default' ||
    (backgroundColor !== 'default' && backgroundColor !== null) ||
    bold ||
    italic ||
    underline ||
    strikethrough ||
    inverse;

  if (needsChalk) {
    // Build chalk chain for custom colors and/or styling
    chalkChain = chalkVar;

    // Only add color methods for custom (non-default, non-null) colors
    if (foregroundColor !== 'default') {
      const fgMatch = foregroundColor.match(/\d+/g);
      if (fgMatch) {
        chalkChain += `.rgb(${fgMatch.join(',')})`;
      }
    }

    if (backgroundColor !== 'default' && backgroundColor !== null) {
      const bgMatch = backgroundColor.match(/\d+/g);
      if (bgMatch) {
        chalkChain += `.bgRgb(${bgMatch.join(',')})`;
      }
    }

    // Apply styling
    if (bold) chalkChain += '.bold';
    if (italic) chalkChain += '.italic';
    if (underline) chalkChain += '.underline';
    if (strikethrough) chalkChain += '.strikethrough';
    if (inverse) chalkChain += '.inverse';
  }

  const formatType = location.identifiers![location.identifiers!.length - 1];
  let reactVar: string,
    textComponent: string,
    messageVar: string,
    outputVar: string | undefined;

  if (formatType === 'memoized_format') {
    [reactVar, textComponent, messageVar, outputVar] = location.identifiers!;
  } else {
    [reactVar, textComponent, messageVar] = location.identifiers!;
  }

  // Replace {} in format string with the message variable
  const formattedMessage =
    '"' + format.replace(/\{\}/g, `"+${messageVar}+"`) + '"';

  let newContent: string;

  if (formatType === 'memoized_format') {
    // CC 2.1.15+ memoized format: we need to preserve the memoization structure
    // Original: O=NKA.createElement(N,{backgroundColor:"userMessageBackground"},X,NKA.createElement(N,{color:"text"},J)),K[5]=J,K[6]=O;else O=K[6];return O
    newContent = `${outputVar}=${reactVar}.createElement(${boxComponent},${boxAttrsObjStr},${reactVar}.createElement(${textComponent},${textAttrsObjStr},${needsChalk ? chalkChain + '(' : ''}${formattedMessage}${needsChalk ? ')' : ''}));return ${outputVar}`;
  } else if (formatType === 'new_format') {
    // New format: preserve the pointer icon structure but apply customizations
    newContent = `
return ${reactVar}.createElement(
  ${boxComponent},
  ${boxAttrsObjStr},
  ${reactVar}.createElement(
    ${textComponent},
    ${textAttrsObjStr},
    ${needsChalk ? chalkChain + '(' : ''}${formattedMessage}${needsChalk ? ')' : ''}
  )
);`;
  } else {
    // Old format
    newContent = `
return ${reactVar}.createElement(
  ${boxComponent},
  ${boxAttrsObjStr},
  ${reactVar}.createElement(
    ${textComponent},
    ${textAttrsObjStr},
    ${needsChalk ? chalkChain + '(' : ''}${formattedMessage}${needsChalk ? ')' : ''}
  )
);`;
  }

  // Apply modification
  const newFile =
    oldFile.slice(0, location.startIndex) +
    newContent +
    oldFile.slice(location.endIndex);

  showDiff(
    oldFile,
    newFile,
    newContent,
    location.startIndex,
    location.endIndex
  );

  return newFile;
};
