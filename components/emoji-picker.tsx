"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

// Curated emoji set grouped by category — no external library needed.
const EMOJI_CATEGORIES: { id: string; label: string; icon: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
      "😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨",
      "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕",
      "🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁",
      "☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣",
      "😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👻",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: "👍",
    emojis: [
      "👍","👎","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️",
      "👋","🤚","🖐️","✋","🖖","👏","🙌","👐","🤲","🤝","🙏","💪","🦵","🦶","👂","🦻",
      "👃","🧠","🦷","🦴","👀","👁️","👅","👄","💋","🫶","💅","🤳","🧑","👤","👥","🫂",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","♥️","💌","💒","💍","💎","✨","🌟","⭐","💫","🔥","💥","💯","🎉",
    ],
  },
  {
    id: "animals",
    label: "Animals",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸",
      "🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴",
      "🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🦗","🕷️","🦂","🦟","🦠","🐢",
      "🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈",
    ],
  },
  {
    id: "food",
    label: "Food",
    icon: "🍔",
    emojis: [
      "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
      "🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐",
      "🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭",
      "🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🍝","🍜","🍲",
      "🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨",
      "🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛",
      "🍼","☕","🫖","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉",
    ],
  },
  {
    id: "activities",
    label: "Activities",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🥅","🏒","🏑",
      "🥍","🏏","🪃","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️",
      "🤸","🤺","⛹️","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴","🏆","🥇",
      "🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    icon: "🚗",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️",
      "🛺","🚲","🛴","🚨","🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄",
      "🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁",
      "🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","⛽","🚧","🚦","🚥","🗺️","🗿","🗽","🗼",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","🧾","💎",
      "⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲",
      "🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿",
      "💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹",
      "🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪",
      "🪑","🛋️","🛏️","🛌","🧸","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🎊","🎉",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: "✅",
    emojis: [
      "✅","☑️","✔️","❌","❎","➕","➖","➗","✖️","♾️","‼️","⁉️","❓","❔","❕","❗",
      "〰️","💱","💲","⚕️","♻️","⚜️","🔱","📛","🔰","⭕","🅿️","🆎","🆑","🆒","🆓","🆔",
      "🆕","🆖","🆗","🆘","🆙","🆚","🔟","🔢","🔣","🔤","🔠","🔡","ℹ️","🔤","🎦","🈁",
      "🈂️","🉐","㊙️","🈶","🈵","🈹","🈸","🈺","🈷️","🈴","🈳","🈚","🈯","💯","🔝","🔜",
    ],
  },
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
  className?: string
}

export function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id)
  const containerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!onClose) return
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  function scrollToCategory(id: string) {
    setActiveCategory(id)
    const el = categoryRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-72 flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-lg",
        className
      )}
    >
      {/* Scrollable emoji grid */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {EMOJI_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            ref={(el) => {
              categoryRefs.current[cat.id] = el
            }}
            className="mb-2"
          >
            <p className="px-1 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((emoji, i) => (
                <button
                  key={`${cat.id}-${i}`}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="flex aspect-square items-center justify-center rounded-md text-xl transition-colors hover:bg-muted active:scale-95"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-t border-border bg-muted/30 px-2 py-1.5">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => scrollToCategory(cat.id)}
            aria-label={cat.label}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg transition-colors",
              activeCategory === cat.id
                ? "bg-primary/10"
                : "hover:bg-muted"
            )}
          >
            {cat.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
