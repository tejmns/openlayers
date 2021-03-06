import {listen} from '../../../../src/ol/events.js';
import Collection from '../../../../src/ol/Collection.js';
import Feature from '../../../../src/ol/Feature.js';
import Map from '../../../../src/ol/Map.js';
import View from '../../../../src/ol/View.js';
import Point from '../../../../src/ol/geom/Point.js';
import LineString from '../../../../src/ol/geom/LineString.js';
import VectorLayer from '../../../../src/ol/layer/Vector.js';
import {bbox as bboxStrategy} from '../../../../src/ol/loadingstrategy.js';
import {get as getProjection, transformExtent, fromLonLat} from '../../../../src/ol/proj.js';
import VectorSource from '../../../../src/ol/source/Vector.js';


describe('ol.source.Vector', function() {

  let pointFeature;
  let infiniteExtent;
  beforeEach(function() {
    pointFeature = new Feature(new Point([0, 0]));
    infiniteExtent = [-Infinity, -Infinity, Infinity, Infinity];
  });

  describe('when empty', function() {

    let vectorSource;
    beforeEach(function() {
      vectorSource = new VectorSource();
    });

    describe('#forEachFeatureInExtent', function() {

      it('does not call the callback', function() {
        const f = sinon.spy();
        vectorSource.forEachFeatureInExtent(infiniteExtent, f);
        expect(f).not.to.be.called();
      });

    });

    describe('#getFeaturesInExtent', function() {

      it('returns an empty array', function() {
        const features = vectorSource.getFeaturesInExtent(infiniteExtent);
        expect(features).to.be.an(Array);
        expect(features).to.be.empty();
      });

    });

    describe('#isEmpty', function() {

      it('returns true', function() {
        expect(vectorSource.isEmpty()).to.be(true);
      });

    });

    describe('#addFeature', function() {

      it('can add a single point feature', function() {
        vectorSource.addFeature(pointFeature);
        const features = vectorSource.getFeaturesInExtent(infiniteExtent);
        expect(features).to.be.an(Array);
        expect(features).to.have.length(1);
        expect(features[0]).to.be(pointFeature);
      });

      it('fires a change event', function() {
        const listener = sinon.spy();
        listen(vectorSource, 'change', listener);
        vectorSource.addFeature(pointFeature);
        expect(listener).to.be.called();
      });

      it('adds same id features only once', function() {
        const source = new VectorSource();
        const feature1 = new Feature();
        feature1.setId('1');
        const feature2 = new Feature();
        feature2.setId('1');
        source.addFeature(feature1);
        source.addFeature(feature2);
        expect(source.getFeatures().length).to.be(1);
      });

    });

    describe('#hasFeature', function() {

      it('returns true for added feature without id', function() {
        const feature = new Feature();
        vectorSource.addFeature(feature);
        expect(vectorSource.hasFeature(feature)).to.be(true);
      });

      it('returns true for added feature with id', function() {
        const feature = new Feature();
        feature.setId('1');
        vectorSource.addFeature(feature);
        expect(vectorSource.hasFeature(feature)).to.be(true);
      });

      it('return false for removed feature', function() {
        const feature = new Feature();
        vectorSource.addFeature(feature);
        vectorSource.removeFeature(feature);
        expect(vectorSource.hasFeature(feature)).to.be(false);
      });

      it('returns false for non-added feature', function() {
        const feature = new Feature();
        expect(vectorSource.hasFeature(feature)).to.be(false);
      });

    });

  });

  describe('when populated with 3 features', function() {

    const features = [];
    let vectorSource;
    beforeEach(function() {
      features.push(new Feature(new LineString([[0, 0], [10, 10]])));
      features.push(new Feature(new Point([0, 10])));
      features.push(new Feature(new Point([10, 5])));
      vectorSource = new VectorSource({
        features: features
      });
    });

    describe('#getClosestFeatureToCoordinate', function() {

      it('returns the expected feature', function() {
        const feature = vectorSource.getClosestFeatureToCoordinate([1, 9]);
        expect(feature).to.be(features[1]);
      });

      it('returns the expected feature when a filter is used', function() {
        const feature = vectorSource.getClosestFeatureToCoordinate([1, 9], function(feature) {
          return feature.getGeometry().getType() == 'LineString';
        });
        expect(feature).to.be(features[0]);
      });

    });

  });

  describe('when populated with 10 random points and a null', function() {

    let features;
    let vectorSource;
    beforeEach(function() {
      features = [];
      let i;
      for (i = 0; i < 10; ++i) {
        features[i] =
            new Feature(new Point([Math.random(), Math.random()]));
      }
      features.push(new Feature(null));
      vectorSource = new VectorSource({
        features: features
      });
    });

    describe('#clear', function() {

      it('removes all features using fast path', function() {
        const changeSpy = sinon.spy();
        listen(vectorSource, 'change', changeSpy);
        const removeFeatureSpy = sinon.spy();
        listen(vectorSource, 'removefeature', removeFeatureSpy);
        const clearSourceSpy = sinon.spy();
        listen(vectorSource, 'clear', clearSourceSpy);
        vectorSource.clear(true);
        expect(vectorSource.getFeatures()).to.eql([]);
        expect(vectorSource.isEmpty()).to.be(true);
        expect(changeSpy).to.be.called();
        expect(changeSpy.callCount).to.be(1);
        expect(removeFeatureSpy).not.to.be.called();
        expect(removeFeatureSpy.callCount).to.be(0);
        expect(clearSourceSpy).to.be.called();
        expect(clearSourceSpy.callCount).to.be(1);
      });

      it('removes all features using slow path', function() {
        const changeSpy = sinon.spy();
        listen(vectorSource, 'change', changeSpy);
        const removeFeatureSpy = sinon.spy();
        listen(vectorSource, 'removefeature', removeFeatureSpy);
        const clearSourceSpy = sinon.spy();
        listen(vectorSource, 'clear', clearSourceSpy);
        vectorSource.clear();
        expect(vectorSource.getFeatures()).to.eql([]);
        expect(vectorSource.isEmpty()).to.be(true);
        expect(changeSpy).to.be.called();
        expect(changeSpy.callCount).to.be(1);
        expect(removeFeatureSpy).to.be.called();
        expect(removeFeatureSpy.callCount).to.be(features.length);
        expect(clearSourceSpy).to.be.called();
        expect(clearSourceSpy.callCount).to.be(1);
      });

    });

    describe('#forEachFeatureInExtent', function() {

      it('is called the expected number of times', function() {
        const f = sinon.spy();
        vectorSource.forEachFeatureInExtent(infiniteExtent, f);
        expect(f.callCount).to.be(10);
      });

      it('allows breaking out', function() {
        let count = 0;
        const result = vectorSource.forEachFeatureInExtent(infiniteExtent,
          function(f) {
            return ++count == 5;
          });
        expect(result).to.be(true);
        expect(count).to.be(5);
      });

    });

    describe('#getFeaturesInExtent', function() {

      it('returns the expected number of features', function() {
        expect(vectorSource.getFeaturesInExtent(infiniteExtent)).
          to.have.length(10);
      });

    });

    describe('#isEmpty', function() {

      it('returns false', function() {
        expect(vectorSource.isEmpty()).to.be(false);
      });

    });

    describe('#removeFeature', function() {

      it('works as expected', function() {
        let i;
        for (i = features.length - 1; i >= 0; --i) {
          vectorSource.removeFeature(features[i]);
          expect(vectorSource.getFeaturesInExtent(infiniteExtent)).
            have.length(i);
        }
      });

      it('fires a change event', function() {
        const listener = sinon.spy();
        listen(vectorSource, 'change', listener);
        vectorSource.removeFeature(features[0]);
        expect(listener).to.be.called();
      });

    });

    describe('modifying a feature\'s geometry', function() {

      it('keeps the R-Tree index up to date', function() {
        expect(vectorSource.getFeaturesInExtent([0, 0, 1, 1])).
          to.have.length(10);
        features[0].getGeometry().setCoordinates([100, 100]);
        expect(vectorSource.getFeaturesInExtent([0, 0, 1, 1])).
          to.have.length(9);
        features[0].getGeometry().setCoordinates([0.5, 0.5]);
        expect(vectorSource.getFeaturesInExtent([0, 0, 1, 1])).
          to.have.length(10);
      });

    });

    describe('setting a features geometry', function() {

      it('keeps the R-Tree index up to date', function() {
        expect(vectorSource.getFeaturesInExtent([0, 0, 1, 1])).
          to.have.length(10);
        features[0].setGeometry(new Point([100, 100]));
        expect(vectorSource.getFeaturesInExtent([0, 0, 1, 1])).
          to.have.length(9);
      });

    });

  });

  describe('tracking changes to features', function() {

    let vectorSource;
    beforeEach(function() {
      vectorSource = new VectorSource();
    });

    it('keeps its index up-to-date', function() {
      const feature = new Feature(new Point([1, 1]));
      vectorSource.addFeature(feature);
      expect(vectorSource.getFeaturesInExtent([0, 0, 2, 2])).
        to.eql([feature]);
      feature.getGeometry().setCoordinates([3, 3]);
      expect(vectorSource.getFeaturesInExtent([0, 0, 2, 2])).
        to.be.empty();
      expect(vectorSource.getFeaturesInExtent([2, 2, 4, 4])).
        to.eql([feature]);
    });

    it('handles features with null geometries', function() {
      const feature = new Feature(null);
      vectorSource.addFeature(feature);
      expect(vectorSource.getFeatures()).to.eql([feature]);
    });

    it('handles features with geometries changing from null', function() {
      const feature = new Feature(null);
      vectorSource.addFeature(feature);
      expect(vectorSource.getFeatures()).to.eql([feature]);
      feature.setGeometry(new Point([1, 1]));
      expect(vectorSource.getFeaturesInExtent([0, 0, 2, 2])).
        to.eql([feature]);
      expect(vectorSource.getFeatures()).to.eql([feature]);
    });

    it('handles features with geometries changing to null', function() {
      const feature = new Feature(new Point([1, 1]));
      vectorSource.addFeature(feature);
      expect(vectorSource.getFeatures()).to.eql([feature]);
      expect(vectorSource.getFeaturesInExtent([0, 0, 2, 2])).
        to.eql([feature]);
      feature.setGeometry(null);
      expect(vectorSource.getFeaturesInExtent([0, 0, 2, 2])).to.be.empty();
      expect(vectorSource.getFeatures()).to.eql([feature]);
    });

    it('fires a change event when setting a feature\'s property', function() {
      const feature = new Feature(new Point([1, 1]));
      vectorSource.addFeature(feature);
      const listener = sinon.spy();
      listen(vectorSource, 'change', listener);
      feature.set('foo', 'bar');
      expect(listener).to.be.called();
    });

    it('fires a changefeature event when updating a feature', function() {
      const feature = new Feature(new Point([1, 1]));
      vectorSource.addFeature(feature);
      const listener = sinon.spy(function(event) {
        expect(event.feature).to.be(feature);
      });
      vectorSource.on('changefeature', listener);
      feature.setStyle(null);
      expect(listener).to.be.called();
    });

  });

  describe('#getFeatureById()', function() {
    let source;
    beforeEach(function() {
      source = new VectorSource();
    });

    it('returns a feature by id', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(feature);
    });

    it('returns a feature by id (set after add)', function() {
      const feature = new Feature();
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(null);
      feature.setId('foo');
      expect(source.getFeatureById('foo')).to.be(feature);
    });

    it('returns null when no feature is found', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('bar')).to.be(null);
    });

    it('returns null after removing feature', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(feature);
      source.removeFeature(feature);
      expect(source.getFeatureById('foo')).to.be(null);
    });

    it('returns null after unsetting id', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(feature);
      feature.setId(undefined);
      expect(source.getFeatureById('foo')).to.be(null);
    });

    it('returns null after clear', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(feature);
      source.clear();
      expect(source.getFeatureById('foo')).to.be(null);
    });

    it('returns null when no features are indexed', function() {
      expect(source.getFeatureById('foo')).to.be(null);
      source.addFeature(new Feature());
      expect(source.getFeatureById('foo')).to.be(null);
    });

    it('returns correct feature after add/remove/add', function() {
      expect(source.getFeatureById('foo')).to.be(null);
      const first = new Feature();
      first.setId('foo');
      source.addFeature(first);
      expect(source.getFeatureById('foo')).to.be(first);
      source.removeFeature(first);
      expect(source.getFeatureById('foo')).to.be(null);
      const second = new Feature();
      second.setId('foo');
      source.addFeature(second);
      expect(source.getFeatureById('foo')).to.be(second);
    });

    it('returns correct feature after add/change', function() {
      expect(source.getFeatureById('foo')).to.be(null);
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      expect(source.getFeatureById('foo')).to.be(feature);
      feature.setId('bar');
      expect(source.getFeatureById('foo')).to.be(null);
      expect(source.getFeatureById('bar')).to.be(feature);
    });

  });

  describe('#loadFeatures', function() {

    describe('with the "bbox" strategy', function() {


      it('requests the view extent plus render buffer', function(done) {
        const center = [-97.6114, 38.8403];
        const source = new VectorSource({
          strategy: bboxStrategy,
          loader: function(extent) {
            setTimeout(function() {
              const lonLatExtent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
              expect(lonLatExtent[0]).to.roughlyEqual(-99.261474609, 1e-9);
              expect(lonLatExtent[2]).to.roughlyEqual(-95.965576171, 1e-9);
              done();
            }, 0);
          }
        });
        const div = document.createElement('div');
        div.style.width = div.style.height = '100px';
        document.body.appendChild(div);
        const map = new Map({
          target: div,
          layers: [
            new VectorLayer({
              source: source
            })
          ],
          view: new View({
            center: fromLonLat(center),
            zoom: 7
          })
        });
        map.renderSync();
        map.setTarget(null);
        document.body.removeChild(div);
      });

    });

    describe('with no loader and the "all" strategy', function() {

      it('stores the infinity extent in the Rtree', function() {
        const source = new VectorSource();
        source.loadFeatures([-10000, -10000, 10000, 10000], 1,
          getProjection('EPSG:3857'));
        const loadedExtents = source.loadedExtentsRtree_.getAll();
        expect(loadedExtents).to.have.length(1);
        expect(loadedExtents[0].extent).to.eql(
          [-Infinity, -Infinity, Infinity, Infinity]);
      });
    });

    describe('with setLoader', function() {

      it('it will change the loader function', function() {
        let count1 = 0;
        const loader1 = function(bbox, resolution, projection) {
          count1++;
        };
        let count2 = 0;
        const loader2 = function(bbox, resolution, projection) {
          count2++;
        };
        const source = new VectorSource({loader: loader1});
        source.loadFeatures([-10000, -10000, 10000, 10000], 1,
          getProjection('EPSG:3857'));
        source.setLoader(loader2);
        source.clear();
        source.loadFeatures([-10000, -10000, 10000, 10000], 1,
          getProjection('EPSG:3857'));
        expect(count1).to.eql(1);
        expect(count2).to.eql(1);
      });

      it('removes extents with #removeLoadedExtent()', function(done) {
        const source = new VectorSource();
        source.setLoader(function(bbox, resolution, projection) {
          setTimeout(function() {
            expect(source.loadedExtentsRtree_.getAll()).to.have.length(1);
            source.removeLoadedExtent(bbox);
            expect(source.loadedExtentsRtree_.getAll()).to.have.length(0);
            done();
          }, 0);
        });
        source.loadFeatures([-10000, -10000, 10000, 10000], 1, getProjection('EPSG:3857'));
      });
    });

  });

  describe('the feature id index', function() {
    let source;
    beforeEach(function() {
      source = new VectorSource();
    });

    it('ignores features with the same id', function() {
      const feature = new Feature();
      feature.setId('foo');
      source.addFeature(feature);
      const dupe = new Feature();
      dupe.setId('foo');
      source.addFeature(dupe);
      expect(source.getFeatures()).to.have.length(1);
      expect(source.getFeatureById('foo')).to.be(feature);
    });

    it('allows changing feature and set the same id', function() {
      const foo = new Feature();
      foo.setId('foo');
      source.addFeature(foo);
      const bar = new Feature();
      bar.setId('bar');
      source.addFeature(bar);
      bar.setId('foo');
      expect(source.getFeatureById('foo')).to.be(bar);
    });

  });

  describe('the undefined feature id index', function() {
    let source;
    beforeEach(function() {
      source = new VectorSource();
    });

    it('disallows adding the same feature twice', function() {
      const feature = new Feature();
      source.addFeature(feature);
      expect(function() {
        source.addFeature(feature);
      }).to.throwException();
    });
  });

  describe('with useSpatialIndex set to false', function() {
    let source;
    beforeEach(function() {
      source = new VectorSource({useSpatialIndex: false});
    });

    it('returns a features collection', function() {
      expect(source.getFeaturesCollection()).to.be.a(Collection);
    });

    it('#forEachFeatureInExtent loops through all features', function() {
      source.addFeatures([new Feature(), new Feature()]);
      const spy = sinon.spy();
      source.forEachFeatureInExtent([0, 0, 0, 0], spy);
      expect(spy.callCount).to.be(2);
    });

  });

  describe('with a collection of features', function() {
    let collection, source;
    beforeEach(function() {
      source = new VectorSource({
        useSpatialIndex: false
      });
      collection = source.getFeaturesCollection();
    });

    it('creates a features collection', function() {
      expect(source.getFeaturesCollection()).to.not.be(null);
    });

    it('adding/removing features keeps the collection in sync', function() {
      const feature = new Feature();
      source.addFeature(feature);
      expect(collection.getLength()).to.be(1);
      source.removeFeature(feature);
      expect(collection.getLength()).to.be(0);
    });

    it('#clear() features keeps the collection in sync', function() {
      const feature = new Feature();
      source.addFeatures([feature]);
      expect(collection.getLength()).to.be(1);
      source.clear();
      expect(collection.getLength()).to.be(0);
      source.addFeatures([feature]);
      expect(collection.getLength()).to.be(1);
      source.clear(true);
      expect(collection.getLength()).to.be(0);
    });

    it('keeps the source\'s features in sync with the collection', function() {
      const feature = new Feature();
      collection.push(feature);
      expect(source.getFeatures().length).to.be(1);
      collection.remove(feature);
      expect(source.getFeatures().length).to.be(0);
      collection.extend([feature]);
      expect(source.getFeatures().length).to.be(1);
      collection.clear();
      expect(source.getFeatures().length).to.be(0);
    });

  });

  describe('with a collection of features plus spatial index', function() {
    let collection, source;
    beforeEach(function() {
      collection = new Collection();
      source = new VectorSource({
        features: collection
      });
    });

    it('#getFeaturesCollection returns the configured collection', function() {
      expect(source.getFeaturesCollection()).to.equal(collection);
    });

    it('adding/removing features keeps the collection in sync', function() {
      const feature = new Feature();
      source.addFeature(feature);
      expect(collection.getLength()).to.be(1);
      source.removeFeature(feature);
      expect(collection.getLength()).to.be(0);
    });

    it('#clear() features keeps the collection in sync', function() {
      const feature = new Feature();
      source.addFeatures([feature]);
      expect(collection.getLength()).to.be(1);
      source.clear();
      expect(collection.getLength()).to.be(0);
      source.addFeatures([feature]);
      expect(collection.getLength()).to.be(1);
      source.clear(true);
      expect(collection.getLength()).to.be(0);
    });

    it('keeps the source\'s features in sync with the collection', function() {
      const feature = new Feature();
      collection.push(feature);
      expect(source.getFeatures().length).to.be(1);
      collection.remove(feature);
      expect(source.getFeatures().length).to.be(0);
      collection.extend([feature]);
      expect(source.getFeatures().length).to.be(1);
      collection.clear();
      expect(source.getFeatures().length).to.be(0);
    });

  });

});
