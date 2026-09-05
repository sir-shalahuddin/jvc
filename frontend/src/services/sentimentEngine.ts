// Sentiment & Kaomoji Generation Engine

function getVariant(list: string[], seed: string | number): string {
  if (!list || list.length === 0) return '(._.)';
  let hash = 0;
  const str = String(seed || '');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return list[Math.abs(hash) % list.length];
}

export interface EmoticonResult {
  text: string;
  type: string;
  color: string;
}

export function getRetroEmoticonData(
  emoji = '',
  emotion = '',
  seed: string | number = ''
): EmoticonResult {
  const emotionLower = (emotion || '').toLowerCase();
  const emojiStr = emoji || '';

  // 1. Fight / Semangat / Determination / Hustle / Strong
  if (
    emotionLower.includes('fight') ||
    emotionLower.includes('semangat') ||
    emotionLower.includes('challenge') ||
    emotionLower.includes('determ') ||
    emotionLower.includes('push') ||
    emotionLower.includes('bisa') ||
    emotionLower.includes('power') ||
    emotionLower.includes('strong')
  ) {
    return {
      text: getVariant(["(ง'̀-'́)ง", '(ง •̀_•́)ง', 'ᕦ(ò_óˇ)ᕤ'], seed),
      type: 'fight',
      color: '#f59e0b',
    };
  }

  // 2. Victory / Party / Celebration / Win
  if (
    emotionLower.includes('party') ||
    emotionLower.includes('celebrat') ||
    emotionLower.includes('win') ||
    emotionLower.includes('victory') ||
    emotionLower.includes('champion') ||
    emotionLower.includes('cheer')
  ) {
    return {
      text: getVariant(['＼(＾O＾)／', '(ﾉ◕ヮ◕)ﾉ', '(≧◡≦)', 'ᕕ( ᐛ )ᕗ'], seed),
      type: 'party',
      color: '#10b981',
    };
  }

  // 3. Love / Appreciation / Grateful / Kudos / Support
  if (
    emotionLower.includes('love') ||
    emotionLower.includes('gratitude') ||
    emotionLower.includes('grateful') ||
    emotionLower.includes('appreciat') ||
    emotionLower.includes('kudos') ||
    emotionLower.includes('thank') ||
    emotionLower.includes('support')
  ) {
    return {
      text: getVariant(['(♥‿♥)', '(人´∀｀)', '(◍•ᴗ•◍)', '( ˘ ³˘)♥'], seed),
      type: 'love',
      color: '#ec4899',
    };
  }

  // 4. Mindblown / Idea / Sparkle / Innovation / Eureka
  if (
    emotionLower.includes('idea') ||
    emotionLower.includes('sparkle') ||
    emotionLower.includes('mindblown') ||
    emotionLower.includes('genius') ||
    emotionLower.includes('eureka') ||
    emotionLower.includes('innovat') ||
    emotionLower.includes('solut')
  ) {
    return {
      text: getVariant(['( ✧Д✧)', '(★ω★)', '( ﾟヮﾟ)', '(⊙_⊙)！'], seed),
      type: 'mindblown',
      color: '#ff5f1f',
    };
  }

  // 5. Panic / Chaos / Incident / Blocker / Fire
  if (
    emotionLower.includes('panic') ||
    emotionLower.includes('chaos') ||
    emotionLower.includes('flip') ||
    emotionLower.includes('incident') ||
    emotionLower.includes('blocker') ||
    emotionLower.includes('disaster') ||
    emotionLower.includes('fire')
  ) {
    return {
      text: getVariant(['(╯°□°)╯', '(ノಠ益ಠ)ノ', '(;￣Д￣)', '┻━┻ ︵ ヽ(`Д´)ﾉ'], seed),
      type: 'panic',
      color: '#ef4444',
    };
  }

  // 6. Exhausted / Burnout / Overworked / Tired
  if (
    emotionLower.includes('tired') ||
    emotionLower.includes('exhaust') ||
    emotionLower.includes('burnout') ||
    emotionLower.includes('sleep') ||
    emotionLower.includes('drained') ||
    emotionLower.includes('overwork')
  ) {
    return {
      text: getVariant(['(×_×)', '(っ- ‸ -ς)', '(-.-)Zzz', '(ノ_ _)ノ'], seed),
      type: 'exhausted',
      color: '#8b5cf6',
    };
  }

  // 7. Crying / Heartbroken / Grief
  if (
    emotionLower.includes('cry') ||
    emotionLower.includes('tear') ||
    emotionLower.includes('broken') ||
    emotionLower.includes('grief') ||
    emotionLower.includes('regret')
  ) {
    return {
      text: getVariant(['ಥ_ಥ', '(T_T)', '( ; _ ; )', '(இдஇ)'], seed),
      type: 'crying',
      color: '#3b82f6',
    };
  }

  // 8. Joy / Happy / Positive
  if (
    emotionLower.includes('joy') ||
    emotionLower.includes('happy') ||
    emotionLower.includes('positive') ||
    emotionLower.includes('good') ||
    emotionLower.includes('great')
  ) {
    return {
      text: getVariant(['(ᵔ◡ᵔ)', '(✿◠‿◠)', '(＾◡＾)', '(^‿^)'], seed),
      type: 'joy',
      color: '#10b981',
    };
  }

  // Fallback Emoji Parsing
  if (['💪', '🥊', '⚔️'].some((e) => emojiStr.includes(e))) {
    return { text: '(ง •̀_•́)ง', type: 'fight', color: '#f59e0b' };
  }
  if (['🎉', '🎊', '🏆', '🚀', '🥳'].some((e) => emojiStr.includes(e))) {
    return { text: '＼(＾O＾)／', type: 'party', color: '#10b981' };
  }
  if (['❤️', '💖', '💕', '🙏', '🥰'].some((e) => emojiStr.includes(e))) {
    return { text: '(♥‿♥)', type: 'love', color: '#ec4899' };
  }
  if (['💡', '✨', '⭐', '🧠'].some((e) => emojiStr.includes(e))) {
    return { text: '( ✧Д✧)', type: 'mindblown', color: '#ff5f1f' };
  }
  if (['💥', '🚨', '⚠️', '🔥'].some((e) => emojiStr.includes(e))) {
    return { text: '(╯°□°)╯', type: 'panic', color: '#ef4444' };
  }

  return {
    text: '(•‿•)',
    type: 'neutral',
    color: '#64748b',
  };
}
