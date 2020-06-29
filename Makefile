VERSION := $(shell git describe | sed -e 's/^v//')
GH_REG_PREFIX := docker.pkg.github.com/occloxium/demo-man
GL_REG_PREFIX := registry.git.rwth-aachen.de/occloxium-webdev/demo-zoomoid-de

version:
	@echo $(VERSION)

build-latest:
	@echo Building locally...
	docker build -t api api/
	docker build -t watchdog watchdog/
	docker build -t client client/

build:
	docker build -t api:$(VERSION) api/
	docker build -t watchdog:$(VERSION) watchdog/
	docker build -t client:$(VERSION) client/

tag-gh: build
	docker tag api:$(VERSION) $(GH_REG_PREFIX)/api:$(VERSION)	
	docker tag watchdog:$(VERSION) $(GH_REG_PREFIX)/watchdog:$(VERSION)	
	docker tag client:$(VERSION) $(GH_REG_PREFIX)/client:$(VERSION)

push-gh: build tag
	docker push $(GH_REG_PREFIX)/api:$(VERSION)
	docker push $(GH_REG_PREFIX)/watchdog:$(VERSION)
	docker push $(GH_REG_PREFIX)/client:$(VERSION)

tag-gl: build
	docker tag api:$(VERSION) $(GL_REG_PREFIX)/api:$(VERSION)	
	docker tag watchdog:$(VERSION) $(GL_REG_PREFIX)/watchdog:$(VERSION)	
	docker tag client:$(VERSION) $(GL_REG_PREFIX)/client:$(VERSION)

push-gl: build tag
	docker push $(GL_REG_PREFIX)/api:$(VERSION)
	docker push $(GL_REG_PREFIX)/watchdog:$(VERSION)
	docker push $(GL_REG_PREFIX)/client:$(VERSION)

github: build tag-gh push-gh

gitlab: build tag-gl push-gl

