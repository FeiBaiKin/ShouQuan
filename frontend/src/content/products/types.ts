import type { LucideIcon } from 'lucide-react'

/** 单条硬事实（机制型信任条） */
export interface FactItem {
  term: string
  label: string
  sub: string
}

/** 功能网格单元 */
export interface FeatureItem {
  icon: LucideIcon
  title: string
  desc: string
}

/** 截图展示区（zigzag，最多 2 段） */
export interface ShowcaseItem {
  kicker: string
  title: string
  desc: string
  points: string[]
  image: string
  imageAlt: string
  /** 可选：倾斜悬浮在主轴图后方的第二张图 */
  backdrop?: string
  backdropAlt?: string
}

export interface StepItem {
  icon: LucideIcon
  title: string
  desc: string
}

export interface NoticeItem {
  icon: LucideIcon
  title: string
  desc: string
}

export interface FaqItem {
  q: string
  a: string
}

/**
 * 产品售卖页内容包：每个产品一份，按 slug 注册。
 * 价格、套餐、最新版本号等动态数据来自 API，不放在内容包里。
 */
export interface ProductContent {
  slug: string
  tagline: string
  cardImage?: string
  demoUrl?: string
  keywords?: string[]
  hero: {
    badge: string
    titleTop: string
    titleHighlight: string
    titleBottom?: string
    subtitle: string
    primaryCta: string
    image: string
    imageAlt: string
    backdrop?: string
    backdropAlt?: string
  }
  featuresTitle: string
  featuresSub: string
  features: FeatureItem[]
  showcase: ShowcaseItem[]
  stepsTitle: string
  stepsSub: string
  steps: StepItem[]
  notices: NoticeItem[]
  faqs: FaqItem[]
  finalCta: {
    title: string
    sub: string
    button: string
  }
}
