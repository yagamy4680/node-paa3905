/**
 * Node.js Native Addon for PX4 Optical Flow Calculation
 *
 * Wraps the PX4Flow block-matching algorithm to compute optical flow
 * between consecutive 35x35 frames captured from the PAA3905 sensor.
 *
 * Uses node-addon-api (N-API) for ABI-stable addon interface.
 */

#include <napi.h>
#include <cstring>
#include "px4flow.hpp"

class OpticalFlowCalculator : public Napi::ObjectWrap<OpticalFlowCalculator> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "OpticalFlowCalculator", {
            InstanceMethod("computeFlow", &OpticalFlowCalculator::ComputeFlow),
            InstanceMethod("reset", &OpticalFlowCalculator::Reset),
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("OpticalFlowCalculator", func);
        return exports;
    }

    OpticalFlowCalculator(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<OpticalFlowCalculator>(info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1 || !info[0].IsObject()) {
            Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
            return;
        }

        Napi::Object opts = info[0].As<Napi::Object>();

        image_width_ = opts.Has("imageWidth")
            ? opts.Get("imageWidth").As<Napi::Number>().Uint32Value() : 35;
        image_height_ = opts.Has("imageHeight")
            ? opts.Get("imageHeight").As<Napi::Number>().Uint32Value() : 35;
        uint32_t search_size = opts.Has("searchSize")
            ? opts.Get("searchSize").As<Napi::Number>().Uint32Value() : 4;
        uint32_t feature_threshold = opts.Has("featureThreshold")
            ? opts.Get("featureThreshold").As<Napi::Number>().Uint32Value() : 30;
        uint32_t value_threshold = opts.Has("valueThreshold")
            ? opts.Get("valueThreshold").As<Napi::Number>().Uint32Value() : 5000;

        image_size_ = image_width_ * image_height_;
        prev_frame_ = new uint8_t[image_size_];
        std::memset(prev_frame_, 0, image_size_);
        has_prev_frame_ = false;

        px4flow_ = new PX4Flow(image_width_, search_size, feature_threshold, value_threshold);
    }

    ~OpticalFlowCalculator() {
        delete px4flow_;
        delete[] prev_frame_;
    }

private:
    PX4Flow* px4flow_;
    uint8_t* prev_frame_;
    uint32_t image_width_;
    uint32_t image_height_;
    uint32_t image_size_;
    bool has_prev_frame_;

    /**
     * computeFlow(frameData: Uint8Array) -> { flowX, flowY, quality }
     *
     * Computes optical flow between the previous frame and the current frame.
     * On the first call, stores the frame and returns quality=0.
     */
    Napi::Value ComputeFlow(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1) {
            Napi::TypeError::New(env, "Uint8Array frame data expected").ThrowAsJavaScriptException();
            return env.Null();
        }

        // Accept Uint8Array or Buffer
        uint8_t* frame_data = nullptr;
        size_t frame_length = 0;

        if (info[0].IsTypedArray()) {
            Napi::TypedArray typed = info[0].As<Napi::TypedArray>();
            if (typed.TypedArrayType() != napi_uint8_array) {
                Napi::TypeError::New(env, "Uint8Array expected").ThrowAsJavaScriptException();
                return env.Null();
            }
            Napi::Uint8Array arr = info[0].As<Napi::Uint8Array>();
            frame_data = arr.Data();
            frame_length = arr.ElementLength();
        } else if (info[0].IsBuffer()) {
            Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
            frame_data = buf.Data();
            frame_length = buf.Length();
        } else {
            Napi::TypeError::New(env, "Uint8Array or Buffer expected").ThrowAsJavaScriptException();
            return env.Null();
        }

        if (frame_length != image_size_) {
            std::string msg = "Frame size mismatch: expected " + std::to_string(image_size_) +
                              ", got " + std::to_string(frame_length);
            Napi::RangeError::New(env, msg).ThrowAsJavaScriptException();
            return env.Null();
        }

        Napi::Object result = Napi::Object::New(env);

        if (!has_prev_frame_) {
            // First frame: store it and return zero flow
            std::memcpy(prev_frame_, frame_data, image_size_);
            has_prev_frame_ = true;

            result.Set("flowX", Napi::Number::New(env, 0.0));
            result.Set("flowY", Napi::Number::New(env, 0.0));
            result.Set("quality", Napi::Number::New(env, 0));
            return result;
        }

        float pixel_flow_x = 0.0f;
        float pixel_flow_y = 0.0f;

        // No gyro compensation (rates = 0)
        uint8_t quality = px4flow_->compute_flow(
            prev_frame_, frame_data,
            0.0f, 0.0f, 0.0f,
            &pixel_flow_x, &pixel_flow_y
        );

        // Store current frame as previous for next call
        std::memcpy(prev_frame_, frame_data, image_size_);

        result.Set("flowX", Napi::Number::New(env, static_cast<double>(pixel_flow_x)));
        result.Set("flowY", Napi::Number::New(env, static_cast<double>(pixel_flow_y)));
        result.Set("quality", Napi::Number::New(env, static_cast<int>(quality)));

        return result;
    }

    /**
     * reset() - Clear the stored previous frame, so next computeFlow
     * call will treat its input as the first frame.
     */
    Napi::Value Reset(const Napi::CallbackInfo& info) {
        has_prev_frame_ = false;
        std::memset(prev_frame_, 0, image_size_);
        return info.Env().Undefined();
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return OpticalFlowCalculator::Init(env, exports);
}

NODE_API_MODULE(optical_flow, Init)
