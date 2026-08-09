import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SkillCinematic, type CinematicRequest } from './SkillCinematic';

/**
 * jsdom has no media pipeline, so `play()` is a stub that must be provided or
 * every test throws "not implemented".
 */
let playImpl: () => Promise<void> = () => Promise.resolve();
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => playImpl(),
  });
});

const request = (over: Partial<CinematicRequest> = {}): CinematicRequest => ({
  id: 'c1',
  actionKey: 'dragon',
  videoUrl: 'https://cdn.example/fx_dragon.webm',
  ...over,
});

describe('SkillCinematic', () => {
  beforeEach(() => {
    playImpl = () => Promise.resolve();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('giữ thẻ video trong cây nhưng ẩn đi khi không có kỹ năng nào chạy', () => {
    const { container } = render(<SkillCinematic request={null} onDone={jest.fn()} />);

    // Trước đây component trả về `null` khi rảnh. Điều đó tháo thẻ `<video>`
    // khỏi cây, và món quà tiếp theo phải dựng lại một bộ giải mã từ đầu —
    // đúng cái khựng mà khán giả thấy ở khoảnh khắc đáng lẽ ấn tượng nhất.
    // Nay thẻ ở lại và chỉ bị ẩn.
    const shell = container.firstElementChild as HTMLElement;
    expect(shell).toHaveStyle({ visibility: 'hidden' });
    expect(container.querySelector('video')).toBeInTheDocument();
    // Và không có nguồn nào để nó tự phát khi đang ẩn.
    expect(container.querySelector('video')).not.toHaveAttribute('src');
  });

  it('dims the screen before the video, not at the same time', () => {
    const { container } = render(<SkillCinematic request={request()} onDone={jest.fn()} />);

    // The beat that tells the room somebody just spent heavily. Starting the
    // video immediately loses it.
    const video = container.querySelector('video');
    expect(video).toHaveStyle({ opacity: '0' });

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(container.querySelector('video')).toHaveStyle({ opacity: '1' });
  });

  it('releases the screen when the video ends', () => {
    const onDone = jest.fn();
    const { container } = render(<SkillCinematic request={request()} onDone={onDone} />);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => {
      container.querySelector('video')!.dispatchEvent(new Event('ended'));
    });

    expect(onDone).toHaveBeenCalled();
  });

  it('gives up on a file that never finishes', () => {
    const onDone = jest.fn();
    render(<SkillCinematic request={request()} onDone={onDone} />);

    // A truncated or corrupt asset would otherwise hold the broadcast forever.
    act(() => {
      jest.advanceTimersByTime(200 + 6000);
    });

    expect(onDone).toHaveBeenCalled();
  });

  it('does not wedge the queue when autoplay is refused', async () => {
    playImpl = () => Promise.reject(new Error('NotAllowedError'));
    const onDone = jest.fn();
    render(<SkillCinematic request={request()} onDone={onDone} />);

    // 200ms làm tối, rồi tối đa 1500ms chờ đủ dữ liệu. Trong jsdom không có
    // đường ống media nên `canplaythrough` không bao giờ phát ra, và nhánh chờ
    // quá hạn mới là nhánh chạy — đó cũng là nhánh phải chứng minh, vì nó là
    // thứ giữ cho hàng đợi không tắc sau một tệp tải chậm.
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Autoplay works in a Browser Source but is blocked in a normal tab. The
    // next skill must still get its turn.
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('drops the previous timers when a new skill replaces the current one', () => {
    const onDone = jest.fn();
    const { rerender } = render(<SkillCinematic request={request()} onDone={onDone} />);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender(<SkillCinematic request={request({ id: 'c2' })} onDone={onDone} />);

    // Past the second request's own guard (200ms dim + 6000ms hold). If the
    // first request's timers had survived the swap, both would have fired by
    // now and this would be 2.
    act(() => {
      jest.advanceTimersByTime(6300);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
