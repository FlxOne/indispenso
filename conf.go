package main

import (
	"github.com/kylelemons/go-gypsy/yaml"
	"os"
	"path/filepath"
)

// Configuration
type Conf struct {
	Tags map[string]bool
}

// Load config files
func (c *Conf) load() {
	mainConf := "/etc/indispenso.conf"
	additionalFilesPath := "/etc/indispenso/conf.d/*"
	files, _ := filepath.Glob(additionalFilesPath)
	files = append([]string{mainConf}, files...) // Prepend item
	for _, file := range files {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			// Not existing
			continue
		}

		// Read
		conf, confErr := yaml.ReadFile(file)
		if confErr != nil {
			log.Printf("Failed reading %s: %v", file, confErr)
			continue
		}

		// Skip empty
		if conf == nil {
			continue
		}

		// Tags
		tags := conf.Root.(yaml.Map).Key("tags").(yaml.List)
		if tags != nil {
			for _, tag := range tags {
				c.Tags[tag.(yaml.Scalar).String()] = true
			}
		}
	}
}

func newConf() *Conf {
	return &Conf{
		Tags: make(map[string]bool),
	}
}
