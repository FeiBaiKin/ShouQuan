package config

import (
	"testing"
)

func validDatabaseConfig() DatabaseConfig {
	return DatabaseConfig{
		Host:          "127.0.0.1",
		Port:          5432,
		User:          "postgres",
		Password:      "secret",
		Name:          "authcenter",
		SSLMode:       "disable",
		TimeZone:      "Asia/Shanghai",
		MaintenanceDB: "postgres",
		AutoCreate:    true,
	}
}

func TestDatabaseConfigValidate(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*DatabaseConfig)
	}{
		{name: "empty host", mutate: func(cfg *DatabaseConfig) { cfg.Host = "" }},
		{name: "invalid port", mutate: func(cfg *DatabaseConfig) { cfg.Port = 70000 }},
		{name: "empty user", mutate: func(cfg *DatabaseConfig) { cfg.User = "" }},
		{name: "invalid database name", mutate: func(cfg *DatabaseConfig) { cfg.Name = "bad name" }},
		{name: "invalid maintenance database", mutate: func(cfg *DatabaseConfig) { cfg.MaintenanceDB = "postgres;drop" }},
		{name: "invalid ssl mode", mutate: func(cfg *DatabaseConfig) { cfg.SSLMode = "invalid" }},
		{name: "empty timezone", mutate: func(cfg *DatabaseConfig) { cfg.TimeZone = "" }},
	}

	if err := validDatabaseConfig().Validate(); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validDatabaseConfig()
			tt.mutate(&cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
}

func TestDatabaseConfigDSNEscapesCredentials(t *testing.T) {
	cfg := validDatabaseConfig()
	cfg.Host = "::1"
	cfg.User = "user@example.com"
	cfg.Password = `p@ss word'\end`

	got := cfg.DSN("authcenter_test")
	want := `host='::1' port=5432 user='user@example.com' password='p@ss word\'\\end' dbname='authcenter_test' sslmode='disable' TimeZone=Asia/Shanghai`
	if got != want {
		t.Fatalf("DSN = %q, want %q", got, want)
	}
}
