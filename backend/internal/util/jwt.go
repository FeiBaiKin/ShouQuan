package util

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ---- JWT（管理后台会话）----

type AdminClaims struct {
	AdminID  uint   `json:"admin_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func GenerateAdminToken(secret string, adminID uint, username string) (string, error) {
	claims := AdminClaims{
		AdminID:  adminID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func ParseAdminToken(secret, tokenStr string) (*AdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &AdminClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("非法签名算法")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*AdminClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("token 无效")
	}
	return claims, nil
}

// ---- 随机码 ----

// 授权码字符集：去掉易混淆的 0/O/1/I
const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// GenerateLicenseCode 生成形如 XXXXX-XXXXX-XXXXX-XXXXX 的授权码
func GenerateLicenseCode() (string, error) {
	groups := make([]string, 4)
	for g := range groups {
		var sb strings.Builder
		for i := 0; i < 5; i++ {
			n, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
			if err != nil {
				return "", err
			}
			sb.WriteByte(codeAlphabet[n.Int64()])
		}
		groups[g] = sb.String()
	}
	return strings.Join(groups, "-"), nil
}

// GenerateToken 生成 32 字节 hex 随机令牌
func GenerateToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
