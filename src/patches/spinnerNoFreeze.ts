// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

const getSpinnerNoFreezeLocation = (oldFile: string): LocationResult | null => {
  // Old pattern (pre CC 2.1.15): X(()=>{if(!frozen){setTimeout(60);return}setState((x)=>x+1)},60)
  const wholePatternOld =
    /\b[$\w]+\(\(\)=>\{if\(![$\w]+\)\{[$\w]+\(\d+\);return\}[$\w]+\(\([^)]+\)=>[^)]+\+1\)\},\d+\)/;
  const wholeMatchOld = oldFile.match(wholePatternOld);

  if (wholeMatchOld && wholeMatchOld.index !== undefined) {
    const freezeBranchPattern = /if\(![$\w]+\)\{[$\w]+\(\d+\);return\}/;
    const condMatch = wholeMatchOld[0].match(freezeBranchPattern);

    if (condMatch && condMatch.index !== undefined) {
      const startIndex = wholeMatchOld.index + condMatch.index;
      const endIndex = startIndex + condMatch[0].length;

      return {
        startIndex: startIndex,
        endIndex: endIndex,
      };
    }
  }

  // New pattern (CC 2.1.15+): useEffect(()=>{if(Y===-1)return;...setTimeout(()=>{z((J)=>J+1)},60)...},[Y])
  // The freeze condition is now: if(Y===-1)return;
  const wholePatternNew =
    /\.useEffect\(\(\)=>\{if\(([$\w]+)===-1\)return;let [$\w]+=\[[^\]]+\];if\(\1>=[$\w]+\.length\)\{[$\w]+\(-1\),[$\w]+\(1\);return\}[$\w]+\([$\w]+\[\1\]\);let ([$\w]+)=setTimeout\(\(\)=>\{[$\w]+\(\([$\w]+\)=>[$\w]+\+1\)\},\d+\);return\(\)=>clearTimeout\(\2\)\},\[\1\]\)/;
  const wholeMatchNew = oldFile.match(wholePatternNew);

  if (wholeMatchNew && wholeMatchNew.index !== undefined) {
    // Find the freeze condition: if(Y===-1)return;
    const freezeConditionNew = /if\([$\w]+===-1\)return;/;
    const condMatchNew = wholeMatchNew[0].match(freezeConditionNew);

    if (condMatchNew && condMatchNew.index !== undefined) {
      const startIndex = wholeMatchNew.index + condMatchNew.index;
      const endIndex = startIndex + condMatchNew[0].length;

      return {
        startIndex: startIndex,
        endIndex: endIndex,
      };
    }
  }

  console.error('patch: spinner no-freeze: failed to find wholeMatch');
  return null;
};

export const writeSpinnerNoFreeze = (oldFile: string): string | null => {
  const location = getSpinnerNoFreezeLocation(oldFile);
  if (!location) {
    return null;
  }

  const newFile =
    oldFile.slice(0, location.startIndex) + oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, '', location.startIndex, location.endIndex);
  return newFile;
};
