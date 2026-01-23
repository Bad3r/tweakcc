// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

const getThinkerSymbolSpeedLocation = (
  oldFile: string
): LocationResult | null => {
  // CC 2.1.15+ format: setTimeout(()=>{z((J)=>J+1)},60)
  const newSpeedPattern =
    /setTimeout\(\(\)=>\{[$\w]+\(\([$\w]+\)=>[$\w]+\+1\)\},(\d+)\)/;
  const newMatch = oldFile.match(newSpeedPattern);

  if (newMatch && newMatch.index !== undefined) {
    const fullMatchText = newMatch[0];
    const capturedNumber = newMatch[1];
    const numberIndex = fullMatchText.lastIndexOf(capturedNumber);
    const startIndex = newMatch.index + numberIndex;
    const endIndex = startIndex + capturedNumber.length;

    return {
      startIndex: startIndex,
      endIndex: endIndex,
    };
  }

  // Old format: X(()=>{if(!frozen){setTimeout(60);return}setState((x)=>x+1)},60)
  const oldSpeedPattern =
    /[, ][$\w]+\(\(\)=>\{if\(![$\w]+\)\{[$\w]+\(\d+\);return\}[$\w]+\(\([^)]+\)=>[^)]+\+1\)\},(\d+)\)/;
  const oldMatch = oldFile.match(oldSpeedPattern);

  if (oldMatch && oldMatch.index !== undefined) {
    const fullMatchText = oldMatch[0];
    const capturedNumber = oldMatch[1];
    const numberIndex = fullMatchText.lastIndexOf(capturedNumber);
    const startIndex = oldMatch.index + numberIndex;
    const endIndex = startIndex + capturedNumber.length;

    return {
      startIndex: startIndex,
      endIndex: endIndex,
    };
  }

  console.error('patch: thinker symbol speed: failed to find match');
  return null;
};

export const writeThinkerSymbolSpeed = (
  oldFile: string,
  speed: number
): string | null => {
  const location = getThinkerSymbolSpeedLocation(oldFile);
  if (!location) {
    return null;
  }

  const speedStr = JSON.stringify(speed);

  const newContent =
    oldFile.slice(0, location.startIndex) +
    speedStr +
    oldFile.slice(location.endIndex);

  showDiff(
    oldFile,
    newContent,
    speedStr,
    location.startIndex,
    location.endIndex
  );
  return newContent;
};
