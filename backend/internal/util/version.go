package util

import (
	"net/url"
	"strconv"
	"strings"
)

// NormalizeDomain 归一化域名：去协议、去路径、去端口、转小写
func NormalizeDomain(input string) string {
	s := strings.TrimSpace(strings.ToLower(input))
	if s == "" {
		return ""
	}
	if strings.Contains(s, "://") {
		if u, err := url.Parse(s); err == nil && u.Host != "" {
			s = u.Host
		}
	}
	// 去路径
	if i := strings.IndexAny(s, "/?#"); i >= 0 {
		s = s[:i]
	}
	// 去端口（保留 IPv6 字面量场景不做特殊处理，网站域名场景足够）
	if i := strings.LastIndex(s, ":"); i >= 0 && !strings.Contains(s, "]") {
		if _, err := strconv.Atoi(s[i+1:]); err == nil {
			s = s[:i]
		}
	}
	return s
}

// CompareVersion 比较两个 semver 风格版本号（v 前缀可选）：a>b 返回 1，a<b 返回 -1，相等返回 0。
// 非数字段按字符串比较，段数不同缺省为 0。
func CompareVersion(a, b string) int {
	pa := splitVersion(a)
	pb := splitVersion(b)
	n := len(pa)
	if len(pb) > n {
		n = len(pb)
	}
	for i := 0; i < n; i++ {
		var sa, sb string
		if i < len(pa) {
			sa = pa[i]
		}
		if i < len(pb) {
			sb = pb[i]
		}
		na, ea := strconv.Atoi(sa)
		nb, eb := strconv.Atoi(sb)
		switch {
		case ea == nil && eb == nil:
			if na != nb {
				if na > nb {
					return 1
				}
				return -1
			}
		default:
			if sa != sb {
				if sa > sb {
					return 1
				}
				return -1
			}
		}
	}
	return 0
}

func splitVersion(v string) []string {
	v = strings.TrimPrefix(strings.TrimSpace(strings.ToLower(v)), "v")
	if v == "" {
		return nil
	}
	// 丢弃预发布/构建后缀之外的简单处理：把 - 和 + 后面的内容并入比较段
	v = strings.ReplaceAll(v, "-", ".")
	v = strings.ReplaceAll(v, "+", ".")
	return strings.Split(v, ".")
}
