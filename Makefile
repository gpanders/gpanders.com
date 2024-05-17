BASE_URL := gpanders.com
SITE_DIR := public

.PHONY: all
all: site.tar.gz

.PHONY: clean
clean:
	$(RM) -r $(SITE_DIR) site.tar.gz

$(SITE_DIR):
	hugo --cleanDestinationDir -d $@

site.tar.gz: $(SITE_DIR)
	tar --strip-components=1 -czf $@ $(SITE_DIR)
