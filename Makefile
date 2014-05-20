
COSEME_NAME        = coseme
FFOSAPP_DIR        = samples/ffosapp
FFOSAPP_LIB_DIR    = $(FFOSAPP_DIR)/lib
FFOSAPP_COSEME_DIR = $(FFOSAPP_LIB_DIR)/$(COSEME_NAME)

.PHONY: dist

app : clean-app
	@ mkdir -p $(FFOSAPP_COSEME_DIR)
	@ echo "Installing CoSeMe library..."
	@ echo "Copy CoSeMe dependencies"
	cp -rfl lib/* $(FFOSAPP_LIB_DIR)/
	@ echo "Copy CoSeMe library"
	cp -rfl src/* $(FFOSAPP_COSEME_DIR)
	@ echo "Done!"

clean-app:
	@ echo "Removing CoSeMe library..."
	@ test ! -d $(FFOSAPP_COSEME_DIR) || rm -r $(FFOSAPP_COSEME_DIR)
	@ echo "Done!"

CONCATENATION_ORDER = build/concatenation_order
DIST_DIR            = dist
DIST_OUT            = $(DIST_DIR)/$(COSEME_NAME).js

dist:
	@ echo "Building CoSeMe libray..."
	@ echo "Development version..."
	mkdir -p $(DIST_DIR)
	cat $(CONCATENATION_ORDER) | xargs cat > $(DIST_OUT)
	@ echo "Minified version..."
	@ yuglify $(DIST_OUT) || echo 'yuglify not found. Skipping minification!'
	@ echo "Done!"
