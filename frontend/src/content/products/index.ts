import type { ProductContent } from './types'
import { xzjiContent } from './xzji'

/**
 * 产品内容注册表（分类器）。
 * 新产品上线：新建一份内容包并登记到这里，/product?slug=xxx 即刻生效；
 * 未登记的产品会使用通用模板渲染（数据来自 API）。
 */
const registry = new Map<string, ProductContent>([[xzjiContent.slug, xzjiContent]])

export function getProductContent(slug: string): ProductContent | null {
  return registry.get(slug) ?? null
}

export type { ProductContent } from './types'
