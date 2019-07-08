VERSION="latest"

docker push stevepieper/base:$VERSION
docker push stevepieper/x11:$VERSION
docker push stevepieper/slicer3:$VERSION
docker push stevepieper/slicer:$VERSION

docker push stevepieper/slicer-chronicle:$VERSION

docker push stevepieper/slicer-dev:$VERSION
